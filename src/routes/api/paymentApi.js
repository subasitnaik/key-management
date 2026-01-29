/**
 * API for payment actions (accept/reject/block) — can be called from seller panel or webhook.
 */

import { Router } from 'express';
import { requireSeller } from '../../middleware/auth.js';
import { getPaymentRequestById } from '../../repositories/paymentRequestRepo.js';
import { updatePaymentRequest } from '../../repositories/paymentRequestRepo.js';
import { getSellerById } from '../../repositories/sellerRepo.js';
import { addLedgerEntry } from '../../repositories/creditLedgerRepo.js';
import { blockUser } from '../../repositories/blockedUserRepo.js';
import { getSupabase } from '../../db/supabase.js';
import { Telegraf } from 'telegraf';

const router = Router();

function generateKey() {
  return 'key_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.post('/accept/:id', requireSeller, async (req, res) => {
  try {
    const prId = parseInt(req.params.id, 10);
    const sellerId = req.session?.sellerId;
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return res.status(400).json({ error: 'Invalid' });
    const plan = await getSupabase().from('plans').select('*').eq('id', pr.plan_id).single().then((r) => r.data);
    const seller = await getSellerById(sellerId);
    if (!plan || !seller) return res.status(400).json({ error: 'Invalid' });
    const ccpu = seller.ccpu || 30;
    const creditsToDeduct = Math.ceil((plan.days / 30) * ccpu);
    if ((seller.credits_balance || 0) < creditsToDeduct) return res.status(400).json({ error: 'Insufficient credits' });

    const key = generateKey();
    const expiresAt = addDays(new Date(), plan.days);
    await getSupabase().from('subscriptions').upsert(
      { user_id: pr.user_id, seller_id: sellerId, key, expires_at: expiresAt.toISOString(), max_devices: 1 },
      { onConflict: 'user_id,seller_id' }
    );
    await addLedgerEntry(sellerId, -creditsToDeduct, `Subscription user ${pr.user_id}`, null);
    await getSupabase().from('sellers').update({ credits_balance: (seller.credits_balance || 0) - creditsToDeduct, updated_at: new Date().toISOString() }).eq('id', sellerId);
    await updatePaymentRequest(prId, { status: 'accepted' });

    const userRow = await getSupabase().from('users').select('telegram_user_id').eq('id', pr.user_id).single().then((r) => r.data);
    if (userRow?.telegram_user_id && seller.telegram_bot_token) {
      const bot = new Telegraf(seller.telegram_bot_token);
      await bot.telegram.sendMessage(userRow.telegram_user_id, `Approved! Your key: ${key}\nExpires: ${expiresAt.toLocaleDateString()}`);
    }
    res.redirect('/panel/seller/payments');
  } catch (e) {
    console.error(e);
    res.redirect('/panel/seller/payments?error=1');
  }
});

router.post('/reject/:id', requireSeller, async (req, res) => {
  try {
    const prId = parseInt(req.params.id, 10);
    const sellerId = req.session?.sellerId;
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return res.status(400).json({ error: 'Invalid' });
    await updatePaymentRequest(prId, { status: 'rejected' });
    const userRow = await getSupabase().from('users').select('telegram_user_id').eq('id', pr.user_id).single().then((r) => r.data);
    const seller = await getSellerById(sellerId);
    if (userRow?.telegram_user_id && seller?.telegram_bot_token) {
      const bot = new Telegraf(seller.telegram_bot_token);
      await bot.telegram.sendMessage(userRow.telegram_user_id, 'Payment rejected. Try again or contact seller.');
    }
    res.redirect('/panel/seller/payments');
  } catch (e) {
    console.error(e);
    res.redirect('/panel/seller/payments?error=1');
  }
});

router.post('/block/:id', requireSeller, async (req, res) => {
  try {
    const prId = parseInt(req.params.id, 10);
    const sellerId = req.session?.sellerId;
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return res.status(400).json({ error: 'Invalid' });
    await blockUser(pr.user_id, sellerId);
    await updatePaymentRequest(prId, { status: 'blocked' });
    res.redirect('/panel/seller/payments');
  } catch (e) {
    console.error(e);
    res.redirect('/panel/seller/payments?error=1');
  }
});

export default router;
