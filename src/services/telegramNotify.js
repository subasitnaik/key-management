/**
 * Telegram notification service. Sends messages per request (serverless-compatible).
 * Loads seller's bot token from DB and sends via Telegraf API; no long-lived bot.
 */

import { Telegraf } from 'telegraf';
import * as sellerRepository from '../repositories/sellerRepository.js';

/**
 * Get a Telegraf instance for a seller (token from DB). Use .telegram.sendMessage etc.
 * Returns null if seller has no token or is suspended.
 */
function getBotForSeller(sellerId) {
  return sellerRepository.findById(sellerId).then((seller) => {
    if (!seller?.telegram_bot_token || seller.suspended) return null;
    return new Telegraf(seller.telegram_bot_token);
  });
}

export function registerBot(sellerId, bot) {
  // No-op: serverless does not keep long-lived bots. Kept for API compatibility.
}

export function setBot(bot) {
  // No-op
}

export async function notifyUserKey(sellerId, telegramUserId, key, expiresAt, groupLink) {
  const bot = await getBotForSeller(sellerId);
  if (!bot) return;
  try {
    let msg = `Your key: \`${key}\`\nExpires: ${expiresAt}`;
    if (groupLink) msg += `\n\nJoin group: ${groupLink}`;
    await bot.telegram.sendMessage(telegramUserId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn('Could not notify user:', e.message);
  }
}

export async function notifyExpiryReminder(sellerId, telegramUserId, expiresAt) {
  const bot = await getBotForSeller(sellerId);
  if (!bot) return;
  try {
    const msg = `Reminder: Your subscription expires on ${expiresAt}. Renew to keep access.`;
    await bot.telegram.sendMessage(telegramUserId, msg);
  } catch (e) {
    console.warn('Could not send expiry reminder:', e.message);
  }
}

export async function notifyExpiredAndRemoved(sellerId, telegramUserId) {
  const bot = await getBotForSeller(sellerId);
  if (!bot) return;
  try {
    const msg = 'Your subscription has expired. You have been removed from the group. Buy a plan again to re-join.';
    await bot.telegram.sendMessage(telegramUserId, msg);
  } catch (e) {
    console.warn('Could not send expiry removal notice:', e.message);
  }
}
