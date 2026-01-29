/**
 * POST /api/telegram/webhook/:sellerId — Telegram webhook handler. Creates bot with session store and handles update.
 */

import { Router } from 'express';
import { getSellerById } from '../../repositories/sellerRepo.js';
import { createBot } from '../../bot/bot.js';
import { registerBotHandlers } from '../../bot/botHandlers.js';

const router = Router();

router.post('/:sellerId', async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId, 10);
    if (!sellerId) return res.status(400).send();
    const seller = await getSellerById(sellerId);
    if (!seller?.telegram_bot_token) return res.status(404).send();

    const bot = createBot(seller.telegram_bot_token, sellerId);
    registerBotHandlers(bot, sellerId);
    await bot.handleUpdate(req.body);
    res.status(200).send();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send();
  }
});

export default router;
