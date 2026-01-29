/**
 * Payment API: Accept, Reject, Block.
 * Used by Seller Panel and Telegram bot.
 */

import express from 'express';
import * as paymentService from '../../services/paymentService.js';
import * as paymentRequestRepository from '../../repositories/paymentRequestRepository.js';
import * as blockedUserRepository from '../../repositories/blockedUserRepository.js';
import * as telegramNotify from '../../services/telegramNotify.js';
import { getSupabase } from '../../db/supabase.js';

const router = express.Router();

router.post('/:id/accept', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await paymentService.acceptPayment(id);
  if (!result) return res.status(400).json({ error: 'invalid_request' });
  if (result.error === 'insufficient_credits') return res.redirect('/panel/seller?err=credits');
  if (result.error) return res.status(400).json({ error: result.error });
  const { data: user } = await getSupabase().from('users').select('telegram_user_id').eq('id', result.user.user_id).single();
  const { data: seller } = await getSupabase().from('sellers').select('private_group_link').eq('id', result.user.seller_id).single();
  if (user) {
    const expiresStr =
      result.expiresAt instanceof Date
        ? result.expiresAt.toISOString().slice(0, 19).replace('T', ' ')
        : String(result.expiresAt);
    telegramNotify
      .notifyUserKey(result.user.seller_id, user.telegram_user_id, result.key, expiresStr, seller?.private_group_link)
      .catch(() => {});
  }
  res.redirect('/panel/seller?accepted=1');
});

router.post('/:id/reject', async (req, res) => {
  await paymentRequestRepository.updateStatus(parseInt(req.params.id, 10), 'rejected');
  res.redirect('/panel/seller?rejected=1');
});

router.post('/:id/block', async (req, res) => {
  const pr = await paymentRequestRepository.findById(parseInt(req.params.id, 10));
  if (pr) {
    await paymentRequestRepository.updateStatus(pr.id, 'blocked');
    await blockedUserRepository.block(pr.user_id, pr.seller_id);
  }
  res.redirect('/panel/seller?blocked=1');
});

export default router;
