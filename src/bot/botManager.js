/**
 * Manages multiple seller bots.
 * Launches one bot per seller who has telegram_bot_token set.
 */

import * as sellerRepository from '../repositories/sellerRepository.js';
import { createBotForSeller } from './bot.js';
import * as telegramNotify from '../services/telegramNotify.js';

const bots = new Map();

export async function launchAllBots() {
  const sellers = await sellerRepository.getAll();
  for (const seller of sellers) {
    if (seller.telegram_bot_token && !seller.suspended) {
      try {
        const result = createBotForSeller(seller.telegram_bot_token, seller.id);
        if (result) {
          result.bot.launch({ allowedUpdates: ['message', 'callback_query', 'chat_join_request'] }).then(() => {
            console.log(`Bot started for seller: ${seller.slug}`);
          }).catch((e) => {
            console.warn(`Bot failed for seller ${seller.slug}:`, e.message);
          });
          bots.set(seller.id, result.bot);
          telegramNotify.registerBot(seller.id, result.bot);
        }
      } catch (e) {
        console.warn(`Could not create bot for seller ${seller.slug}:`, e.message);
      }
    }
  }
}

export function getBotForSeller(sellerId) {
  return bots.get(sellerId) || null;
}
