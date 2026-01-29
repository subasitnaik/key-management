/**
 * Telegraf bot factory: creates bot with session store. Session key = sellerId:fromId:chatId.
 */

import { Telegraf, session } from 'telegraf';
import { createSupabaseSessionStore } from './supabaseSessionStore.js';

export function createBot(token, sellerId) {
  const store = createSupabaseSessionStore();
  const bot = new Telegraf(token);
  bot.use(session({
    getSessionKey: (ctx) => {
      const fromId = ctx.from?.id ?? 0;
      const chatId = ctx.chat?.id ?? 0;
      return `${sellerId}:${fromId}:${chatId}`;
    },
    store,
  }));
  return bot;
}
