/**
 * Seller panel: login, dashboard, keys, plans, payments, maintenance, reset.
 */

import { Router } from 'express';
import { requireSeller } from '../middleware/auth.js';
import { verifySeller, getSellerById, updateSeller } from '../repositories/sellerRepo.js';
import { getSubscriptionsBySeller } from '../repositories/subscriptionRepo.js';
import { getPlansBySeller } from '../repositories/planRepo.js';
import { getPendingBySeller } from '../repositories/paymentRequestRepo.js';
import { getLedgerBySeller } from '../repositories/creditLedgerRepo.js';
import { getSupabase } from '../db/supabase.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.session?.sellerId) return res.redirect('/panel/seller');
  res.render('seller/login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const seller = await verifySeller(username, password);
  if (!seller) return res.render('seller/login', { error: 'Invalid credentials' });
  req.session = req.session || {};
  req.session.sellerId = seller.id;
  res.status(200).render('seller/login-redirect');
});

router.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/panel/seller/login');
});

router.get('/', requireSeller, async (req, res) => {
  const seller = await getSellerById(req.session.sellerId);
  res.render('seller/dashboard', { creditsBalance: seller?.credits_balance ?? 0 });
});

router.get('/keys', requireSeller, async (req, res) => {
  const subs = await getSubscriptionsBySeller(req.session.sellerId);
  res.render('seller/keys', { subscriptions: subs || [] });
});

router.get('/plans', requireSeller, async (req, res) => {
  const plans = await getPlansBySeller(req.session.sellerId);
  res.render('seller/plans', { plans: plans || [] });
});

router.get('/payments', requireSeller, async (req, res) => {
  const pending = await getPendingBySeller(req.session.sellerId);
  res.render('seller/payments', { pending: pending || [] });
});

router.post('/maintenance', requireSeller, async (req, res) => {
  const seller = await getSellerById(req.session.sellerId);
  const next = seller?.maintenance_mode ? 0 : 1;
  if (next === 1) {
    await getSupabase().from('subscriptions').update({ maintenance_paused_at: new Date().toISOString() }).eq('seller_id', req.session.sellerId);
  }
  await updateSeller(req.session.sellerId, { maintenance_mode: next });
  res.redirect('/panel/seller');
});

router.post('/reset', requireSeller, async (req, res) => {
  const sellerId = req.session.sellerId;
  await getSupabase().from('subscriptions').delete().eq('seller_id', sellerId);
  res.redirect('/panel/seller?reset=done');
});

export default router;
