/**
 * Send Telegram messages using seller's bot token from DB. One-off Telegraf per send (serverless).
 */

import { Telegraf } from 'telegraf';
import { getSellerById } from '../repositories/sellerRepo.js';

export async function sendTelegramMessage(sellerId, chatId, text, opts = {}) {
  const seller = await getSellerById(sellerId);
  if (!seller?.telegram_bot_token) return;
  const bot = new Telegraf(seller.telegram_bot_token);
  await bot.telegram.sendMessage(chatId, text, { parse_mode: opts.parse_mode || 'HTML', ...opts });
}

export async function sendPaymentRequestToSeller(sellerId, text, opts = {}) {
  const seller = await getSellerById(sellerId);
  if (!seller?.telegram_username) return;
  const bot = await getBotForSeller(sellerId);
  if (!bot) return;
  await bot.telegram.sendMessage(`@${seller.telegram_username.replace('@', '')}`, text, { parse_mode: 'HTML', ...opts });
}

async function getBotForSeller(sellerId) {
  const seller = await getSellerById(sellerId);
  if (!seller?.telegram_bot_token) return null;
  return new Telegraf(seller.telegram_bot_token);
}
