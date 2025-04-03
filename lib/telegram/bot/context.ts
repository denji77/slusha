import { SlushaContext } from '../setup-bot.ts';
import { replyWithMarkdown } from '../helpers.ts';
import { Composer } from 'grammy';

const bot = new Composer<SlushaContext>();

bot.command('context', async (ctx) => {
    const textParts = ctx.msg.text.split(' ').map((arg) => arg.trim());
    const config = ctx.info.config;

    const currentValue = ctx.m.getChat().messagesToPass ?? config.messagesToPass;

    if (textParts.length < 2) {
        return replyWithMarkdown(
            ctx,
            'Provide the number of messages that I will remember - `/context 16`\n\n' +
                'Smaller values give more accurate answers, larger values improve memory. Maximum 200.\n' +
                `Current value - ${currentValue}. Provide \`default\` to return to the default number of messages (currently ${config.messagesToPass}, but may change with updates)`,
        );
    }

    if (ctx.chat.type !== 'private') {
        const admins = await ctx.getChatAdministrators();
        if (!admins.some((a) => a.user.id === ctx.from?.id)) {
            return ctx.reply('This command is only for chat administrators');
        }
    }

    if (textParts[1] === 'default') {
        ctx.m.getChat().messagesToPass = undefined;
        return replyWithMarkdown(
            ctx,
            `Number of messages set to default value (${config.messagesToPass})`,
        );
    }

    const count = parseInt(textParts[1]);
    if (isNaN(count)) {
        return ctx.reply('Could not understand the number of messages');
    }

    if (count < 1 || count > 200) {
        return ctx.reply('The number of messages must be between 1 and 200');
    }

    ctx.m.getChat().messagesToPass = count;

    let msg = `Number of messages set to ${count}`;
    if (count > 60) {
        msg += '\n\n`TODO: allow large context`';
    }

    return replyWithMarkdown(ctx, msg);
});

export default bot;
