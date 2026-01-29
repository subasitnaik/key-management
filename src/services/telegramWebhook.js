/**
 * Set or clear Telegram webhook for a seller (serverless: webhook URL receives updates).
 */

import { Telegraf } from 'telegraf';

const baseUrl = (process.env.PANEL_URL || '').replace(/\/$/, '');

export async function setTelegramWebhook(sellerId, token) {
  if (!baseUrl || !token || !token.trim()) return;
  try {
    const bot = new Telegraf(token.trim());
    const url = `${baseUrl}/api/telegram/webhook/${sellerId}`;
    await bot.telegram.setWebhook(url);
  } catch (e) {
    console.warn('Could not set Telegram webhook:', e?.message || e);
  }
}
