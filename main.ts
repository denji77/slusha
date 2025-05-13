// main.ts

// Step 1: Ensure environment is ready (either from Vercel or local .env via lib/env.ts)
import './lib/env.ts'; // This script should gracefully handle missing .env on Vercel

// Step 2: Critical Environment Variable Checks
// Define which environment variables are absolutely essential for the bot to run.
const CRITICAL_ENV_VARS: string[] = [
    'TELEGRAM_BOT_TOKEN',
    'AI_TOKEN',
    // Add any other absolutely essential variables here, e.g.,
    // 'DATABASE_URL', if your memory persistence relies on it from the start.
];

let allCriticalVarsPresent = true;
for (const varName of CRITICAL_ENV_VARS) {
    if (Deno.env.get(varName) === undefined) {
        // Use console.error here, as the main logger might not be initialized yet,
        // or its initialization might depend on these very environment variables.
        console.error(
            `CRITICAL ERROR: Required environment variable "${varName}" is not set. ` +
            `Please ensure it is configured in your Vercel project settings or local .env file.`,
        );
        allCriticalVarsPresent = false;
    }
}

if (!allCriticalVarsPresent) {
    console.error(
        'One or more critical environment variables are missing. Bot cannot start. Exiting.',
    );
    Deno.exit(1); // Exit immediately if critical configuration is absent.
}

// Step 3: Import other modules now that critical environment variables are confirmed.
import Werror from './lib/werror.ts';
import logger from './lib/logger.ts'; // Assuming lib/logger.ts is correctly set up
import resolveConfig, { Config, safetySettings } from './lib/config.ts';
import setupBot from './lib/telegram/setup-bot.ts';
import { run } from 'npm:@grammyjs/runner';
import { loadMemory, ReplyTo } from './lib/memory.ts';

import { APICallError, CoreMessage, generateText, Output } from 'npm:ai';
import { google } from 'npm:@ai-sdk/google';

import {
    createNameMatcher,
    deleteOldFiles,
    formatReply,
    getRandomNepon,
    msgTypeSupported,
    prettyDate,
    probability,
    sliceMessage,
    testMessage,
} from './lib/helpers.ts';
import {
    doTyping,
    replyGeneric,
    replyWithMarkdown,
    replyWithMarkdownId,
} from './lib/telegram/helpers.ts';
import { limit } from 'npm:@grammyjs/ratelimiter';
import character from './lib/telegram/bot/character.ts';
import optOut from './lib/telegram/bot/opt-out.ts';
import msgDelay from './lib/telegram/bot/msg-delay.ts';
import notes from './lib/telegram/bot/notes.ts';
import { makeHistoryV2 } from './lib/history.ts';
import z from 'npm:zod';
import contextCommand from './lib/telegram/bot/context.ts';

// --- Application Initialization ---

let config: Config;
try {
    logger.info('Resolving application configuration...');
    config = await resolveConfig();
    logger.info('Configuration resolved successfully.');
} catch (error) {
    logger.error('Failed to resolve application configuration:', error);
    Deno.exit(1);
}

let memory; // Declare memory here so it's in scope for intervals if loadMemory is async
try {
    logger.info('Loading memory...');
    memory = await loadMemory(); // Assuming loadMemory returns the memory instance
    logger.info('Memory loaded successfully.');
} catch (error) {
    // The original error was "logger.warn is not a function" here.
    // This assumes logger IS correctly set up now. If not, this line itself might fail.
    logger.error('Failed to load memory:', error);
    Deno.exit(1);
}

let bot;
try {
    logger.info('Setting up Telegram bot...');
    bot = await setupBot(config, memory);
    logger.info('Telegram bot setup complete.');
} catch (error) {
    logger.error('Failed to set up Telegram bot:', error);
    Deno.exit(1);
}

// --- Bot Command Handlers and Middleware ---

bot.command('start', (ctx) => ctx.reply(config.startMessage));

bot.command('forget', async (ctx) => {
    ctx.m.clear();
    await ctx.reply('History cleared');
});

bot.command('lobotomy', async (ctx) => {
    if (ctx.chat.type !== 'private') {
        const admins = await ctx.getChatAdministrators();
        if (!admins.some((a) => a.user.id === ctx.from?.id)) {
            return ctx.reply('This command is only for chat administrators');
        }
    }
    ctx.m.clear();
    const chatMemory = ctx.m.getChat();
    chatMemory.notes = [];
    chatMemory.memory = undefined;
    await ctx.reply('Complete lobotomy successful. All chat-specific data wiped.');
});

bot.command('changelog', async (ctx) => {
    await replyWithMarkdown(
        ctx,
        '```js\n// TODO: write what\'s new```\n\nYou can check the commits - https://github.com/denji77/slusha/commits/alpha/',
    );
});

bot.use(optOut);
bot.use(contextCommand);
bot.use(character);

bot.command('model', (ctx) => {
    if (
        !config.adminIds || !ctx.msg.from ||
        !config.adminIds.includes(ctx.msg.from.id)
    ) {
        return ctx.reply(`Access denied. This command is for bot administrators. Your ID: ${ctx.msg.from?.id}`);
    }

    const args = ctx.msg.text?.split(' ').map((arg) => arg.trim()).filter(Boolean) ?? [];
    const chatMemory = ctx.m.getChat();

    if (args.length === 1) {
        return ctx.reply(`Current model: ${chatMemory.chatModel ?? config.ai.model}`);
    }

    const newModel = args[1];
    if (newModel === 'default') {
        chatMemory.chatModel = undefined;
        return ctx.reply('AI model reset to default.');
    }

    chatMemory.chatModel = newModel;
    return ctx.reply(`AI model set to: ${newModel}`);
});

bot.command('random', async (ctx) => {
    const args = ctx.msg.text?.split(' ').map((arg) => arg.trim()).filter(Boolean) ?? [];
    const chatMemory = ctx.m.getChat();
    const currentValue = chatMemory.randomReplyProbability ?? config.randomReplyProbability;

    if (args.length === 1) {
        return replyWithMarkdown(
            ctx,
            'Specify a number from 0 to 50 as the second argument to set the frequency of random replies: `/random <number>`\n' +
                `Currently set to \`${currentValue}\`%\n` +
                '`/random default` - set to default value',
        );
    }

    if (ctx.chat.type !== 'private') {
        const admins = await ctx.getChatAdministrators();
        if (!admins.some((a) => a.user.id === ctx.from?.id)) {
            return ctx.reply('This command is only for chat administrators in group chats.');
        }
    }

    const newValue = args[1];
    if (newValue === 'default') {
        chatMemory.randomReplyProbability = undefined;
        return ctx.reply('Random reply probability reset to default.');
    }

    const probabilityValue = parseFloat(newValue);
    if (isNaN(probabilityValue) || probabilityValue < 0 || probabilityValue > 50) {
        return ctx.reply('Invalid probability value. Please provide a number between 0 and 50.');
    }

    chatMemory.randomReplyProbability = probabilityValue;
    return ctx.reply(`Random reply probability updated to: ${probabilityValue}%`);
});

bot.command('summary', (ctx) => {
    const chatMemory = ctx.m.getChat();
    chatMemory.lastUse = Date.now();
    const notesToDisplay = chatMemory.notes.slice(-config.maxNotesToStore - 2);

    if (notesToDisplay.length === 0) {
        return ctx.reply('Not enough messages have passed for a summary, read it yourself!');
    }
    return ctx.reply(notesToDisplay.join('\n').replace(/\n\n/g, '\n'));
});

bot.command('hatemode', async (ctx) => {
    const chatMemory = ctx.m.getChat();
    if (ctx.chat.type !== 'private') {
        const admins = await ctx.getChatAdministrators();
        if (!admins.some((a) => a.user.id === ctx.from?.id)) {
            return ctx.reply(
                `This command is only for chat administrators.\n` +
                `Hate mode is currently: ${chatMemory.hateMode ? 'enabled' : 'disabled'}.`,
            );
        }
    }
    chatMemory.hateMode = !chatMemory.hateMode;
    return ctx.reply(
        `Hate mode is now ${chatMemory.hateMode ? 'ENABLED' : 'disabled'}.`,
    );
});

bot.use(msgDelay(config));
bot.use(notes(config, bot.botInfo.id));

// --- Message Filtering Logic ---
bot.on('message', (ctx, next) => {
    const msg = ctx.m.getLastMessage();
    if (!msg) return;

    if (!msg.text && !msgTypeSupported(msg.info) && !msg.info.new_chat_members) {
        return;
    }
    if (msg.info.via_bot?.id === bot.botInfo.id) return; // Ignore self

    const chatMemory = ctx.m.getChat();

    if (ctx.msg.chat.type === 'private') {
        chatMemory.lastUse = Date.now();
        return next();
    }
    if (ctx.msg.reply_to_message?.from?.id === bot.botInfo.id) {
        chatMemory.lastUse = Date.now();
        return next();
    }
    if (msg.text?.includes(bot.botInfo.username)) { // Check msg.text exists
        chatMemory.lastUse = Date.now();
        return next();
    }

    const characterNames = chatMemory.character?.names;
    const namesToMatch = config.names.concat(characterNames ?? []);
    const nameRegex = createNameMatcher(namesToMatch);

    if (msg.text && nameRegex.test(msg.text) && // Check msg.text exists
        !(msg.info.forward_origin?.type === 'user' &&
            msg.info.forward_origin.sender_user.id === bot.botInfo.id)
    ) {
        chatMemory.lastUse = Date.now();
        logger.info(`Replying due to name mention in: "${sliceMessage(msg.text, 50)}"`);
        return next();
    }

    if (msg.text && testMessage(config.tendToIgnore, msg.text) && // Check msg.text exists
        msg.text.length < 20 &&
        probability(config.tendToIgnoreProbability)
    ) {
        return; // Silently ignore
    }

    if (msg.text && testMessage(config.tendToReply, msg.text) && // Check msg.text exists
        probability(config.tendToReplyProbability)
    ) {
        logger.info(`Replying due to tendToReply keyword in: "${sliceMessage(msg.text, 50)}"`);
        ctx.info.isRandom = true;
        return next();
    }

    const randomReplyProb = chatMemory.randomReplyProbability ?? config.randomReplyProbability;
    if (probability(randomReplyProb)) {
        logger.info('Replying due to random probability.');
        ctx.info.isRandom = true;
        return next();
    }
});

// --- Rate Limiting ---
bot.use(limit({
    timeFrame: 2000,
    limit: 1,
    onLimitExceeded: () => {/* logger.info('Rate limit (1msg/2s) exceeded.'); */},
    keyGenerator: (ctx) => ctx.chat?.id.toString() ?? ctx.from?.id.toString(),
}));

bot.use(limit({
    timeFrame: 1 * 60 * 1000, // 1 minute
    limit: 20,
    onLimitExceeded: (ctx) => {
        logger.warn(`Rate limit (20msg/min) exceeded for chat/user: ${ctx.chat?.id ?? ctx.from?.id}`);
        return ctx.reply('You are sending messages too quickly. Please wait a moment.');
    },
    keyGenerator: (ctx) => ctx.chat?.id.toString() ?? ctx.from?.id.toString(),
}));

// --- Main Message Handler (AI Interaction) ---
bot.on('message', async (ctx) => {
    const chatMemory = ctx.m.getChat();
    const messages: CoreMessage[] = [];
    let systemPrompt = config.ai.prePrompt + '\n\n';

    const savedHistory = ctx.m.getHistory();
    const isComments = savedHistory.some((m) =>
        m.info.forward_origin?.type === 'channel' &&
        m.info.from?.first_name === 'Telegram'
    );

    if (ctx.chat.type === 'private') {
        if (config.ai.privateChatPromptAddition) systemPrompt += config.ai.privateChatPromptAddition;
    } else if (isComments && config.ai.commentsPromptAddition) {
        systemPrompt += config.ai.commentsPromptAddition;
    } else if (config.ai.groupChatPromptAddition) {
        systemPrompt += config.ai.groupChatPromptAddition;
    }

    if (chatMemory.hateMode && config.ai.hateModePrompt) {
        systemPrompt += '\n' + config.ai.hateModePrompt;
    }
    systemPrompt += '\n\n';

    const currentCharacter = chatMemory.character;
    if (currentCharacter) {
        systemPrompt += '### Character ###\n' + currentCharacter.description;
    } else {
        systemPrompt += config.ai.prompt;
    }
    messages.push({ role: 'system', content: systemPrompt });

    let chatContextInfo = `Date and time right now: ${prettyDate()}`;
    if (ctx.chat.type === 'private' && ctx.from) {
        chatContextInfo += `\nPrivate chat with ${ctx.from.first_name} (@${ctx.from.username ?? 'N/A'})`;
    } else if (ctx.chat.title) {
        const activeMembers = ctx.m.getActiveMembers();
        if (activeMembers.length > 0) {
            const prettyMembersList = activeMembers.map((m) =>
                `- ${m.first_name}${m.username ? ` (@${m.username})` : ''}`
            ).join('\n');
            chatContextInfo += `\nChat: ${ctx.chat.title}, Active members:\n${prettyMembersList}`;
        } else {
            chatContextInfo += `\nChat: ${ctx.chat.title}`;
        }
    }

    if (chatMemory.notes.length > 0) {
        chatContextInfo += `\n\nChat notes (previous important points):\n${chatMemory.notes.join('\n')}`;
    }
    if (chatMemory.memory) {
        chatContextInfo += `\n\nMY OWN PERSONAL NOTES AND MEMORY (confidential to me):\n${chatMemory.memory}`;
    }
    messages.push({ role: 'assistant', content: chatContextInfo });

    const messagesToPassCount = chatMemory.messagesToPass ?? config.ai.messagesToPass;
    let historyToPass: CoreMessage[] = [];
    try {
        historyToPass = await makeHistoryV2(
            { token: bot.token, id: bot.botInfo.id },
            bot.api,
            logger, // Assuming logger is fine now
            savedHistory,
            {
                messagesLimit: messagesToPassCount,
                bytesLimit: config.ai.bytesLimit,
                symbolLimit: config.ai.messageMaxLength,
            },
        );
    } catch (error) {
        logger.error('Could not construct message history for AI:', error);
        if (!ctx.info.isRandom) await ctx.reply(getRandomNepon(config));
        return;
    }
    messages.push(...historyToPass);

    let userFinalPrompt = config.ai.finalPrompt;
    if (ctx.info.userToReply) {
        userFinalPrompt += ` IMPORTANT: Your response should directly address or reply to the message from ${ctx.info.userToReply}.`;
    }
    messages.push({ role: 'user', content: userFinalPrompt });

    const currentModel = chatMemory.chatModel ?? config.ai.model;
    const requestTime = Date.now();

    let aiResult;
    try {
        aiResult = await generateText({
            model: google(currentModel, { safetySettings }),
            experimental_output: Output.object({
                // @ts-expect-error schema definition might need adjustment based on actual AI SDK expectations
                schema: z.array(z.object({
                    text: z.string().min(1, "AI response text cannot be empty"), // Ensure text is not empty
                    reply_to: z.string().optional(),
                })),
            }),
            temperature: config.ai.temperature,
            topK: config.ai.topK,
            topP: config.ai.topP,
            messages,
        });
    } catch (error) {
        logger.error('AI text generation failed:', error);
        if (error instanceof APICallError && error.responseBody) {
            try {
                const errDetails = JSON.parse(error.responseBody);
                if (errDetails?.promptFeedback?.blockReason) {
                    return ctx.reply(
                        `AI generation blocked. Reason: ${errDetails.promptFeedback.blockReason}. This might be due to safety settings or the prompt content.`,
                    );
                }
            } catch (parseError) {
                logger.error('Could not parse AI error response body:', parseError);
            }
        }
        if (!ctx.info.isRandom) await ctx.reply(getRandomNepon(config));
        return;
    }

    // @ts-expect-error Assuming experimental_output matches the type, but good to verify
    const aiOutputParts = aiResult.experimental_output as { text: string; reply_to?: string }[];

    if (!aiOutputParts || aiOutputParts.length === 0 || aiOutputParts.every(p => p.text.trim() === "")) {
        logger.warn('AI returned no usable text content.');
        if (!ctx.info.isRandom) await ctx.reply("I'm a bit lost for words right now. Try again?");
        return;
    }

    const chatIdentifier = ctx.chat.first_name ?? ctx.chat.title ?? `ID ${ctx.chat.id}`;
    const chatUsername = ctx.chat?.username ? `(@${ctx.chat.username})` : '';
    logger.info(
        `AI response time: ${(Date.now() - requestTime) / 1000}s for "${chatIdentifier}" ${chatUsername}. Response:\n`,
        formatReply(aiOutputParts, currentCharacter), // Ensure formatReply can handle this structure
    );

    let lastMessageIdSentByBot: number | null = null;
    for (let i = 0; i < aiOutputParts.length; i++) {
        const part = aiOutputParts[i];
        let replyText = part.text.trim();
        if (!replyText) continue; // Skip empty parts

        if (replyText.startsWith('* ')) replyText = '-' + replyText.slice(1); // Basic list formatting

        let messageIdToReplyTo: number | undefined;
        if (part.reply_to) {
            const targetUserMessage = savedHistory.findLast((m) =>
                m.info.from?.username && `@${m.info.from.username}` === part.reply_to
            );
            if (targetUserMessage) messageIdToReplyTo = targetUserMessage.id;
        }
        if (!messageIdToReplyTo && lastMessageIdSentByBot && i > 0) { // If replying to a multi-part bot message
             messageIdToReplyTo = lastMessageIdSentByBot;
        }


        let sentMessageInfo;
        try {
            if (ctx.chat.type === 'private') {
                sentMessageInfo = await replyGeneric(ctx, replyText, false, 'Markdown');
            } else {
                sentMessageInfo = await replyWithMarkdownId(ctx, replyText, messageIdToReplyTo);
            }
        } catch (replyError) {
            logger.error('Failed to send reply to user:', replyError);
            if (!ctx.info.isRandom && i === 0) await ctx.reply(getRandomNepon(config)); // Only send nepon if first part fails
            continue; // Try sending next part if any
        }

        lastMessageIdSentByBot = sentMessageInfo.message_id;
        let replyToContext: ReplyTo | undefined;
        if (sentMessageInfo.reply_to_message) {
            replyToContext = {
                id: sentMessageInfo.reply_to_message.message_id,
                text: sentMessageInfo.reply_to_message.text ?? sentMessageInfo.reply_to_message.caption ?? '',
                isMyself: false,
                info: sentMessageInfo.reply_to_message,
            };
        }
        ctx.m.addMessage({
            id: sentMessageInfo.message_id,
            text: replyText,
            isMyself: true,
            info: sentMessageInfo,
            replyTo: replyToContext,
        });

        if (i < aiOutputParts.length - 1) { // If there are more parts
            const nextPartText = aiOutputParts[i + 1]?.text ?? "";
            if (nextPartText.trim()) { // Only wait if next part has content
                const typingSpeedCharsPerMs = 1200 / (60 * 1000); // Chars per minute to chars per ms
                let msToWait = nextPartText.length / typingSpeedCharsPerMs;
                msToWait = Math.min(msToWait, 5000); // Max 5s wait
                msToWait = Math.max(msToWait, 500);   // Min 0.5s wait if there's a next part
                if (msToWait > 0) await new Promise((resolve) => setTimeout(resolve, msToWait));
            }
        }
    }
});

// --- Start Bot and Periodic Tasks ---
try {
    run(bot); // Starts the bot (long-polling or webhook via runner)
    logger.info('Bot is now running and connected to Telegram.');
} catch (error) {
    logger.error('Failed to start Telegram bot runner:', error);
    Deno.exit(1);
}

// Periodic task: Save memory
// Ensure 'memory' object from 'await loadMemory()' has a 'save' method.
if (memory && typeof memory.save === 'function') {
    setInterval(async () => {
        try {
            await memory.save();
            // logger.debug('Memory saved periodically.'); // Use debug for frequent successful ops
        } catch (error) {
            logger.error('Periodic memory save failed:', error);
        }
    }, 60 * 1000); // Every minute
} else {
    logger.warn("Memory object does not have a save method. Periodic save disabled.");
}

// Periodic task: Delete old files
setInterval(async () => {
    try {
        await deleteOldFiles(logger, config.filesMaxAge);
        // logger.info('Old files cleanup task ran.');
    } catch (error) {
        logger.error('Periodic old files deletion failed:', error);
    }
}, 60 * 60 * 1000); // Every hour

// --- Graceful Shutdown ---
async function gracefulShutdown(signal: Deno.Signal) {
    logger.info(`Received signal: ${signal}. Shutting down gracefully...`);
    try {
        if (memory && typeof memory.save === 'function') {
            await memory.save();
            logger.info('Memory saved successfully on exit.');
        }
    } catch (error) {
        // Use Werror or just log, but ensure it doesn't prevent bot.stop()
        logger.error('Error saving memory during shutdown:', new Werror(error, 'Saving memory on exit'));
    } finally {
        if (bot) {
            logger.info('Stopping Telegram bot...');
            await bot.stop(); // grammY's stop method for the runner
            logger.info('Telegram bot stopped.');
        }
        Deno.exit(0); // Exit with success code
    }
}

Deno.addSignalListener('SIGINT', () => gracefulShutdown('SIGINT'));
if (Deno.build.os !== 'windows') {
    Deno.addSignalListener('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

logger.info("Application initialization sequence complete. Bot should be operational if 'Bot started' and 'Bot is now running' logs appear.");