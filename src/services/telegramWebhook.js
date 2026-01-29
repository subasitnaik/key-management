/**
 * Set/delete Telegram webhook for a seller's bot. Uses PANEL_URL.
 */

import { getSellerById } from '../repositories/sellerRepo.js';

export async function setTelegramWebhook(sellerId) {
  const seller = await getSellerById(sellerId);
  if (!seller?.telegram_bot_token) return;
  const base = (process.env.PANEL_URL || '').replace(/\/$/, '');
  if (!base) return;
  const url = `${base}/api/telegram/webhook/${sellerId}`;
  const allowedUpdates = ['message', 'callback_query', 'chat_join_request'];
  const res = await fetch(`https://api.telegram.org/bot${seller.telegram_bot_token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: allowedUpdates }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error('setWebhook failed:', data);
  return data.ok;
}

export async function deleteTelegramWebhook(sellerId) {
  const seller = await getSellerById(sellerId);
  if (!seller?.telegram_bot_token) return;
  const res = await fetch(`https://api.telegram.org/bot${seller.telegram_bot_token}/deleteWebhook`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  return data.ok;
}
