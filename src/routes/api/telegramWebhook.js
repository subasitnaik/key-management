/**
 * Telegram webhook handler. Receives updates from Telegram per seller (serverless-compatible).
 * No long-running bot process; each request creates or reuses bot and handles one update.
 */

import express from 'express';
import * as sellerRepository from '../../repositories/sellerRepository.js';
import { createBotForSeller } from '../../bot/bot.js';
import { createSupabaseSessionStore } from '../../bot/supabaseSessionStore.js';

const router = express.Router({ mergeParams: true });

router.post('/:sellerId', express.json(), async (req, res) => {
  const sellerId = parseInt(req.params.sellerId, 10);
  if (!sellerId || !Number.isFinite(sellerId)) {
    return res.sendStatus(404);
  }
  const seller = await sellerRepository.findById(sellerId);
  if (!seller?.telegram_bot_token || seller.suspended) {
    return res.sendStatus(404);
  }
  const store = createSupabaseSessionStore();
  const result = createBotForSeller(seller.telegram_bot_token, sellerId, store);
  if (!result) return res.sendStatus(500);
  const { bot } = result;
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (e) {
    console.error('Telegram webhook error:', e?.message || e);
    res.sendStatus(200);
  }
});

export default router;
