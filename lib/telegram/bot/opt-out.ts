import { SlushaContext } from '../setup-bot.ts';
import { OptOutUser } from '../../memory.ts';
import { replyWithHTML } from '../helpers.ts';
import logger from '../../logger.ts';
import { Composer, InlineKeyboard } from 'grammy';

const bot = new Composer<SlushaContext>();

function formatOptOutUsers(users: OptOutUser[]) {
    let message = '\n\n Users that Slusha will no longer see:\n';

    message += users.map((u) => {
        if (u.username) {
            return `- <a href="https://t.me/${u.username}">${u.first_name}</a>`;
        } else {
            return u.first_name;
        }
    }).join('\n');

    return message;
}

bot.command('optout', (ctx) => {
    if (!ctx.from) {
        return;
    }

    let message =
        '<b>Slusha will no longer see your messages in this chat.</b>\n' +
        '<span class="tg-spoiler">except for direct replies from other users to your message mentioning Slusha</span>';

    const optOutUsers = ctx.m.getChat().optOutUsers;

    if (!optOutUsers.find((u) => u.id === ctx.from?.id)) {
        optOutUsers.push({
            id: ctx.from.id,
            first_name: ctx.from.first_name,
            username: ctx.from.username,
        });
    }

    if (optOutUsers.length > 1) {
        message += formatOptOutUsers(optOutUsers);
    }

    return replyWithHTML(ctx, message, {
        reply_markup: new InlineKeyboard().text(
            'Return',
            `opt-in ${ctx.from.id}`,
        ),
        link_preview_options: {
            is_disabled: true,
        },
    });
});

bot.callbackQuery(/opt-in.*/, (ctx) => {
    if (Number(ctx.callbackQuery.data.split(' ')[1]) !== ctx.from?.id) {
        return ctx.answerCallbackQuery('Не твоя кнопка');
    }

    return optIn(ctx, ctx.callbackQuery.from.id, false);
});

bot.command('optin', (ctx) => {
    const id = ctx.from?.id;
    if (!id) {
        return;
    }

    return optIn(ctx, id, true);
});

async function optIn(ctx: SlushaContext, id: number, reply: boolean) {
    const wasOptedIn = ctx.m.getChat().optOutUsers.some((u) => u.id === id);
    const verb = wasOptedIn ? 'again' : 'already';
    let message = `Yay, Slusha ${verb} sees your messages`;

    ctx.m.getChat().optOutUsers = ctx.m.getChat().optOutUsers.filter((u) =>
        u.id !== id
    );

    if (ctx.m.getChat().optOutUsers.length > 1) {
        message += formatOptOutUsers(ctx.m.getChat().optOutUsers);
    }

    if (reply) {
        return replyWithHTML(ctx, message, {
            link_preview_options: {
                is_disabled: true,
            },
        });
    }

    try {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true,
            },
        });
    } catch (error) {
        logger.error('Could not edit message: ', error);
    }
}

export default bot;
