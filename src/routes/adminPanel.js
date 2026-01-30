/**
 * Master Admin panel: login, dashboard, settings, sellers, credits, webhook on bot token save.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireMasterAdmin } from '../middleware/auth.js';
import { verifyMasterAdmin } from '../repositories/masterAdminRepo.js';
import { getAllSellers, getSellerById, createSeller, updateSeller } from '../repositories/sellerRepo.js';
import { getActiveSubscriptionsCount } from '../repositories/subscriptionRepo.js';
import { getEarnedAmountBySeller } from '../repositories/paymentRequestRepo.js';
import { addLedgerEntry } from '../repositories/creditLedgerRepo.js';
import { setTelegramWebhook } from '../services/telegramWebhook.js';

const router = Router();

export async function handleSettingsPage(req, res) {
  res.render('admin/settings');
}

router.get('/login', (req, res) => {
  if (req.session?.masterAdminId) return res.redirect('/panel/admin');
  res.render('admin/login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await verifyMasterAdmin(username, password);
  if (!admin) return res.render('admin/login', { error: 'Invalid credentials' });
  req.session = req.session || {};
  req.session.masterAdminId = admin.id;
  res.status(200).render('admin/login-redirect');
});

router.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/panel/admin/login');
});

router.get('/', requireMasterAdmin, async (req, res) => {
  const sellers = await getAllSellers();
  const sellersWithStats = await Promise.all(
    (sellers || []).map(async (s) => {
      const [activeUsers, earnedAmount] = await Promise.all([
        getActiveSubscriptionsCount(s.id),
        getEarnedAmountBySeller(s.id),
      ]);
      return { seller: s, activeUsers: activeUsers ?? 0, earnedAmount: earnedAmount ?? 0 };
    })
  );
  res.render('admin/dashboard', { sellersWithStats: sellersWithStats || [] });
});

router.get('/sellers', requireMasterAdmin, async (req, res) => {
  const sellers = await getAllSellers();
  res.render('admin/sellers', {
    sellers: sellers || [],
    created: req.query.created === '1',
    deleted: req.query.deleted === '1',
  });
});

router.get('/sellers/new', requireMasterAdmin, (req, res) => {
  res.render('admin/seller-form', {
    seller: null,
    error: req.query.error,
    errorMessage: req.query.error_msg ? decodeURIComponent(req.query.error_msg) : undefined,
  });
});

router.post('/sellers', requireMasterAdmin, async (req, res) => {
  try {
    const { slug, username, password, ccpu, query_channel_enabled, telegram_username, telegram_bot_token, private_group_link, query_group_link } = req.body || {};
    if (!slug || !username || !password) return res.redirect(303, '/panel/admin/sellers?error=missing');
    const hash = bcrypt.hashSync(password, 10);
    const row = {
      slug: slug.trim(),
      username: username.trim(),
      password_hash: hash,
      ccpu: parseInt(ccpu, 10) || 30,
      query_channel_enabled: query_channel_enabled ? 1 : 0,
      telegram_username: telegram_username?.trim() || null,
      telegram_bot_token: telegram_bot_token?.trim() || null,
      private_group_link: private_group_link?.trim() || null,
      query_group_link: query_group_link?.trim() || null,
    };
    const seller = await createSeller(row);
    // Set webhook in background so POST responds quickly (avoids timeout/redirect issues)
    if (row.telegram_bot_token && seller?.id) {
      setTelegramWebhook(seller.id).catch((e) => console.error('setTelegramWebhook:', e));
    }
    return res.redirect(303, '/panel/admin/sellers?created=1');
  } catch (err) {
    console.error('Create seller failed:', err?.message || err);
    const msg = (err?.message || '').toLowerCase();
    const code = msg.includes('unique') || msg.includes('duplicate') ? 'duplicate' : 'error';
    const safeMsg = encodeURIComponent((err?.message || '').slice(0, 200));
    return res.redirect(303, '/panel/admin/sellers/new?error=' + code + (safeMsg ? '&error_msg=' + safeMsg : ''));
  }
});

router.get('/sellers/:id', requireMasterAdmin, async (req, res) => {
  const seller = await getSellerById(parseInt(req.params.id, 10));
  if (!seller) return res.redirect('/panel/admin/sellers');
  res.render('admin/seller-form', {
    seller,
    creditsSuccess: req.query.credits === '1',
    creditsError: req.query.error === 'amount',
  });
});

router.post('/sellers/:id', requireMasterAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const seller = await getSellerById(id);
  if (!seller) return res.redirect('/panel/admin/sellers');
  const { username, ccpu, telegram_username, telegram_bot_token, query_channel_enabled, query_group_link, private_group_link } = req.body || {};
  const updates = {};
  if (username !== undefined) updates.username = username.trim();
  if (ccpu !== undefined) updates.ccpu = parseInt(ccpu, 10) || 30;
  if (telegram_username !== undefined) updates.telegram_username = telegram_username?.trim() || null;
  if (telegram_bot_token !== undefined) updates.telegram_bot_token = telegram_bot_token?.trim() || null;
  if (query_channel_enabled !== undefined) updates.query_channel_enabled = query_channel_enabled ? 1 : 0;
  if (query_group_link !== undefined) updates.query_group_link = query_group_link?.trim() || null;
  if (private_group_link !== undefined) updates.private_group_link = private_group_link?.trim() || null;
  await updateSeller(id, updates);
  if (updates.telegram_bot_token !== undefined) await setTelegramWebhook(id);
  res.redirect('/panel/admin/sellers');
});

router.post('/sellers/:id/credits', requireMasterAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { amount, reason } = req.body || {};
  const delta = parseInt(amount, 10);
  if (!delta || isNaN(delta)) return res.redirect(303, '/panel/admin/sellers/' + id + '?error=amount');
  const seller = await getSellerById(id);
  if (!seller) return res.redirect(303, '/panel/admin/sellers');
  await addLedgerEntry(id, delta, reason || 'Manual adjustment', req.session?.masterAdminId);
  const newBalance = (seller.credits_balance || 0) + delta;
  await updateSeller(id, { credits_balance: Math.max(0, newBalance) });
  return res.redirect(303, '/panel/admin/sellers/' + id + '?credits=1');
});

router.post('/sellers/:id/delete', requireMasterAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const seller = await getSellerById(id);
  if (!seller) return res.redirect(303, '/panel/admin/sellers');
  await updateSeller(id, { suspended: 1 });
  return res.redirect(303, '/panel/admin/sellers?deleted=1');
});

export default router;
