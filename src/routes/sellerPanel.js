/**
 * Seller panel: login, dashboard, keys, plans, payments, maintenance, reset.
 */

import { Router } from 'express';
import { requireSeller } from '../middleware/auth.js';
import { verifySeller, getSellerById, updateSeller } from '../repositories/sellerRepo.js';
import { getSubscriptionsBySeller } from '../repositories/subscriptionRepo.js';
import { getPlansBySeller, getPlanById, createPlan, updatePlan, deletePlan } from '../repositories/planRepo.js';
import { getPendingBySeller } from '../repositories/paymentRequestRepo.js';
import { getLedgerBySeller } from '../repositories/creditLedgerRepo.js';
import { createSubscription } from '../repositories/subscriptionRepo.js';
import { findOrCreateUserByTelegram } from '../repositories/userRepo.js';
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

function randomKey() {
  return 'key_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

router.get('/keys', requireSeller, async (req, res) => {
  const subs = await getSubscriptionsBySeller(req.session.sellerId);
  res.render('seller/keys', {
    subscriptions: subs || [],
    generated: req.query.generated === '1',
    generatedKey: req.query.key ? decodeURIComponent(req.query.key) : undefined,
  });
});

router.get('/keys/generate', requireSeller, (req, res) => {
  res.render('seller/generate-key', { error: req.query.error });
});

router.post('/keys/generate', requireSeller, async (req, res) => {
  try {
    const sellerId = req.session.sellerId;
    const { key_type, custom_key, max_devices, days } = req.body || {};
    const keyType = (key_type || 'random').toLowerCase();
    const daysNum = Math.max(1, parseInt(days, 10) || 1);
    const maxDevices = Math.max(1, parseInt(max_devices, 10) || 1);

    let keyStr;
    if (keyType === 'custom' && custom_key && String(custom_key).trim()) {
      keyStr = String(custom_key).trim();
      const { data: existing } = await getSupabase().from('subscriptions').select('id').eq('key', keyStr).maybeSingle();
      if (existing) return res.redirect(303, '/panel/seller/keys/generate?error=duplicate');
    } else {
      keyStr = randomKey();
    }

    const placeholderUserId = 'manual_' + sellerId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const user = await findOrCreateUserByTelegram(placeholderUserId, 'Manual key');
    const expiresAt = addDays(new Date(), daysNum);

    await createSubscription({
      user_id: user.id,
      seller_id: sellerId,
      key: keyStr,
      max_devices: maxDevices,
      expires_at: expiresAt.toISOString(),
    });

    return res.redirect(303, '/panel/seller/keys?generated=1&key=' + encodeURIComponent(keyStr));
  } catch (err) {
    console.error('Generate key failed:', err?.message || err);
    return res.redirect(303, '/panel/seller/keys/generate?error=error');
  }
});

router.get('/plans', requireSeller, async (req, res) => {
  const plans = await getPlansBySeller(req.session.sellerId);
  res.render('seller/plans', {
    plans: plans || [],
    created: req.query.created === '1',
    deleted: req.query.deleted === '1',
  });
});

router.get('/plans/new', requireSeller, (req, res) => {
  res.render('seller/plan-form', { plan: null, error: req.query.error });
});

router.post('/plans', requireSeller, async (req, res) => {
  try {
    const { name, days, price } = req.body || {};
    if (!name || !days || !price) return res.redirect(303, '/panel/seller/plans/new?error=missing');
    const sellerId = req.session.sellerId;
    const row = {
      seller_id: sellerId,
      name: String(name).trim(),
      days: Math.max(1, parseInt(days, 10) || 1),
      price: Math.max(0, parseFloat(price) || 0),
    };
    await createPlan(row);
    return res.redirect(303, '/panel/seller/plans?created=1');
  } catch (err) {
    console.error('Create plan failed:', err?.message || err);
    return res.redirect(303, '/panel/seller/plans/new?error=error');
  }
});

router.get('/plans/:id/edit', requireSeller, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const plan = await getPlanById(id);
  if (!plan || plan.seller_id !== req.session.sellerId) return res.redirect(303, '/panel/seller/plans');
  res.render('seller/plan-form', { plan, error: req.query.error });
});

router.post('/plans/:id', requireSeller, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const plan = await getPlanById(id);
  if (!plan || plan.seller_id !== req.session.sellerId) return res.redirect(303, '/panel/seller/plans');
  const { name, days, price } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (days !== undefined) updates.days = Math.max(1, parseInt(days, 10) || 1);
  if (price !== undefined) updates.price = Math.max(0, parseFloat(price) || 0);
  await updatePlan(id, updates);
  return res.redirect(303, '/panel/seller/plans?updated=1');
});

router.post('/plans/:id/delete', requireSeller, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const plan = await getPlanById(id);
  if (!plan || plan.seller_id !== req.session.sellerId) return res.redirect(303, '/panel/seller/plans');
  await deletePlan(id);
  return res.redirect(303, '/panel/seller/plans?deleted=1');
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
