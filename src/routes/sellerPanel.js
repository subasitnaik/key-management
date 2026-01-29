/**
 * Seller Panel routes.
 */

import express from 'express';
import { requireSeller, authenticateSeller } from '../middleware/auth.js';
import * as sellerRepository from '../repositories/sellerRepository.js';
import * as planRepository from '../repositories/planRepository.js';
import * as subscriptionRepository from '../repositories/subscriptionRepository.js';
import * as paymentRequestRepository from '../repositories/paymentRequestRepository.js';
import * as blockedUserRepository from '../repositories/blockedUserRepository.js';
import { generateKey } from '../utils/keygen.js';
import { getSupabase } from '../db/supabase.js';
import * as userRepository from '../repositories/userRepository.js';

const router = express.Router();
router.use(express.urlencoded({ extended: true }));

router.get('/login', (req, res) => {
  if (req.session?.sellerId) return res.redirect('/panel/seller');
  res.render('seller/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const seller = await authenticateSeller(username?.trim(), password);
  if (!seller) {
    return res.render('seller/login', { error: 'Invalid credentials' });
  }
  req.session.sellerId = seller.id;
  res.redirect('/panel/seller');
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/panel/seller/login');
});

router.use(requireSeller);

router.get(/^\/?$/, async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const plans = await planRepository.findBySeller(seller.id);
  const pendingPayments = await paymentRequestRepository.findPendingBySeller(seller.id);
  const accepted = req.query.accepted === '1';
  const rejected = req.query.rejected === '1';
  const blocked = req.query.blocked === '1';
  const err = req.query.err || null;
  const { data: subs } = await getSupabase()
    .from('subscriptions')
    .select('*, users!user_id(telegram_username)')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(50);
  const subsList = (subs || []).map((s) => ({ ...s, telegram_username: s.users?.telegram_username }));
  res.render('seller/dashboard', {
    seller,
    plans,
    pendingPayments,
    subscriptions: subsList,
    maintenance: req.query.maintenance || null,
    reset: req.query.reset || null,
    settings: req.query.settings || null,
    accepted,
    rejected,
    blocked,
    err,
  });
});

router.get('/credits', async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const { data: ledger } = await getSupabase()
    .from('credit_ledger')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(100);
  res.render('seller/credits', { seller, ledger: ledger || [] });
});

router.get('/plans', async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const plans = await planRepository.findBySeller(seller.id);
  const err = req.query.err || null;
  const updated = req.query.updated === '1';
  const deleted = req.query.deleted === '1';
  res.render('seller/plans', { seller, plans, err, updated, deleted });
});

router.post('/plans', async (req, res) => {
  const { name, days, price } = req.body || {};
  if (!name || !days || !price) return res.redirect('/panel/seller/plans?err=missing');
  await planRepository.create({
    sellerId: req.session.sellerId,
    name: name.trim(),
    days: parseInt(days, 10),
    price: parseFloat(price),
  });
  res.redirect('/panel/seller/plans');
});

router.get('/plans/:id/edit', async (req, res) => {
  const plan = await planRepository.findById(req.params.id);
  if (!plan || plan.seller_id !== req.session.sellerId) return res.redirect('/panel/seller/plans');
  const seller = await sellerRepository.findById(req.session.sellerId);
  const err = req.query.err || null;
  res.render('seller/plan-edit', { seller, plan, err });
});

router.post('/plans/:id', async (req, res) => {
  const { name, days, price } = req.body || {};
  if (!name || !days || !price) return res.redirect(`/panel/seller/plans/${req.params.id}/edit?err=missing`);
  const ok = await planRepository.update(parseInt(req.params.id, 10), req.session.sellerId, {
    name: name.trim(),
    days: parseInt(days, 10),
    price: parseFloat(price),
  });
  res.redirect('/panel/seller/plans' + (ok ? '?updated=1' : ''));
});

router.post('/plans/:id/delete', async (req, res) => {
  const ok = await planRepository.remove(parseInt(req.params.id, 10), req.session.sellerId);
  res.redirect('/panel/seller/plans?' + (ok ? 'deleted=1' : 'err=inuse'));
});

router.get('/blocked', async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const blocked = await blockedUserRepository.findBlockedBySeller(seller.id);
  const unblocked = req.query.unblocked === '1';
  res.render('seller/blocked', { seller, blocked, unblocked });
});

router.post('/blocked/:userId/unblock', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const sellerId = req.session.sellerId;
  await blockedUserRepository.unblock(userId, sellerId);
  res.redirect('/panel/seller/blocked?unblocked=1');
});

router.get('/keys', async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const plans = await planRepository.findBySeller(seller.id);
  const key = req.query.key || null;
  const err = req.query.err || null;
  res.render('seller/keys', { seller, plans, key, err });
});

router.post('/keys', async (req, res) => {
  const { max_devices_mode, max_devices_custom, days, custom_key } = req.body || {};
  const seller = await sellerRepository.findById(req.session.sellerId);
  let maxDevices = 1;
  if (max_devices_mode === 'custom') {
    const customVal = parseInt(max_devices_custom, 10);
    if (!customVal || customVal < 2) {
      return res.redirect('/panel/seller/keys?err=devices');
    }
    maxDevices = customVal;
  }
  const placeholderUserId = 'manual-' + seller.id + '-' + Date.now();
  let user = await userRepository.findByTelegramId(placeholderUserId);
  if (!user) {
    const { error } = await getSupabase()
      .from('users')
      .insert({ telegram_user_id: placeholderUserId, telegram_username: 'manual' });
    if (error) throw error;
    user = await userRepository.findByTelegramId(placeholderUserId);
  }
  const key = custom_key?.trim() || generateKey(12);
  const plans = await planRepository.findBySeller(seller.id);
  const plan = plans.find((p) => p.days === parseInt(days, 10));
  const daysNum = plan ? plan.days : parseInt(days, 10) || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysNum);
  await subscriptionRepository.create({
    userId: user.id,
    sellerId: seller.id,
    key,
    expiresAt: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
    maxDevices,
  });
  res.redirect(`/panel/seller/keys?key=${encodeURIComponent(key)}`);
});

router.post('/maintenance', async (req, res) => {
  const enabled = req.body?.enabled === '1';
  await sellerRepository.setMaintenanceMode(req.session.sellerId, enabled);
  res.redirect('/panel/seller?maintenance=' + (enabled ? 'on' : 'off'));
});

router.get('/reset', async (req, res) => {
  const seller = await sellerRepository.findById(req.session.sellerId);
  const err = req.query.err || null;
  res.render('seller/reset', { seller, step: 1, err });
});

router.post('/reset', async (req, res) => {
  const step = parseInt(req.body?.step, 10) || 1;
  const confirm = req.body?.confirm;
  if (step === 1) {
    if (confirm !== 'RESET') return res.redirect('/panel/seller/reset?err=confirm');
    const seller = await sellerRepository.findById(req.session.sellerId);
    return res.render('seller/reset', { seller, step: 2 });
  }
  if (step === 2) {
    if (confirm !== 'YES') return res.redirect('/panel/seller/reset?err=confirm2');
    await subscriptionRepository.deleteBySeller(req.session.sellerId);
    await blockedUserRepository.unblockAllBySeller(req.session.sellerId);
    return res.redirect('/panel/seller?reset=done');
  }
  res.redirect('/panel/seller/reset');
});

router.post('/settings', async (req, res) => {
  const { telegram_username, private_group_link, private_group_chat_id, query_group_link } = req.body || {};
  const { error } = await getSupabase()
    .from('sellers')
    .update({
      telegram_username: telegram_username?.trim() || null,
      private_group_link: private_group_link?.trim() || null,
      private_group_chat_id: private_group_chat_id?.trim() || null,
      query_group_link: query_group_link?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.session.sellerId);
  if (error) throw error;
  res.redirect('/panel/seller?settings=saved');
});

export default router;
