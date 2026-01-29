/**
 * Master Admin panel: login, dashboard, settings, sellers, credits, webhook on bot token save.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireMasterAdmin } from '../middleware/auth.js';
import { verifyMasterAdmin } from '../repositories/masterAdminRepo.js';
import { getAllSellers, getSellerById, createSeller, updateSeller } from '../repositories/sellerRepo.js';
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
  res.render('admin/dashboard');
});

router.get('/sellers', requireMasterAdmin, async (req, res) => {
  const sellers = await getAllSellers();
  res.render('admin/sellers', { sellers: sellers || [] });
});

router.get('/sellers/new', requireMasterAdmin, (req, res) => {
  res.render('admin/seller-form', { seller: null });
});

router.post('/sellers', requireMasterAdmin, async (req, res) => {
  const { slug, username, password, ccpu, query_channel_enabled } = req.body || {};
  if (!slug || !username || !password) return res.redirect('/panel/admin/sellers?error=missing');
  const hash = bcrypt.hashSync(password, 10);
  await createSeller({
    slug: slug.trim(),
    username: username.trim(),
    password_hash: hash,
    ccpu: parseInt(ccpu, 10) || 30,
    query_channel_enabled: query_channel_enabled ? 1 : 0,
  });
  res.redirect('/panel/admin/sellers');
});

router.get('/sellers/:id', requireMasterAdmin, async (req, res) => {
  const seller = await getSellerById(parseInt(req.params.id, 10));
  if (!seller) return res.redirect('/panel/admin/sellers');
  res.render('admin/seller-form', { seller });
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
  if (!delta) return res.redirect('/panel/admin/sellers?error=amount');
  const seller = await getSellerById(id);
  if (!seller) return res.redirect('/panel/admin/sellers');
  await addLedgerEntry(id, delta, reason || 'Manual adjustment', req.session?.masterAdminId);
  const newBalance = (seller.credits_balance || 0) + delta;
  await updateSeller(id, { credits_balance: Math.max(0, newBalance) });
  res.redirect('/panel/admin/sellers');
});

export default router;
