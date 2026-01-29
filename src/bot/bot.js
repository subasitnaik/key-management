/**
 * Telegraf bot factory: creates bot with session store. Session key = sellerId:fromId:chatId.
 */

import { Telegraf, session } from 'telegraf';
import { createSupabaseSessionStore } from './supabaseSessionStore.js';

export function createBot(token, sellerId) {
  const store = createSupabaseSessionStore();
  const bot = new Telegraf(token, {
    handler: (ctx, next) => {
      const fromId = ctx.from?.id ?? 0;
      const chatId = ctx.chat?.id ?? 0;
      ctx.sessionKey = `${sellerId}:${fromId}:${chatId}`;
      return next();
    },
  });
  bot.use(session({
    getSessionKey: (ctx) => ctx.sessionKey ?? `default:${ctx.from?.id}:${ctx.chat?.id}`,
    store,
  }));
  return bot;
}
