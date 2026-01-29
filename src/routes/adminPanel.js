/**
 * Master Admin Panel routes.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { requireMasterAdmin, authenticateMasterAdmin } from '../middleware/auth.js';
import * as sellerRepository from '../repositories/sellerRepository.js';
import * as masterAdminRepository from '../repositories/masterAdminRepository.js';
import { getSupabase } from '../db/supabase.js';
import { setTelegramWebhook } from '../services/telegramWebhook.js';

const router = express.Router({ strict: false });
router.use(express.urlencoded({ extended: true }));

router.get('/login', (req, res) => {
  if (req.session?.masterAdminId) return res.redirect('/panel/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const admin = await authenticateMasterAdmin(username?.trim(), password);
  if (!admin) {
    return res.render('admin/login', { error: 'Invalid credentials' });
  }
  req.session.masterAdminId = admin.id;
  res.redirect('/panel/admin');
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/panel/admin/login');
});

router.use(requireMasterAdmin);

router.get('/', async (req, res) => {
  const sellers = await sellerRepository.getAll();
  res.render('admin/dashboard', { sellers });
});

export async function handleSettingsPage(req, res) {
  const admin = await masterAdminRepository.findById(req.session.masterAdminId);
  if (!admin) return res.redirect('/panel/admin/login');
  const saved = req.query.saved === '1';
  const err = req.query.err || null;
  res.render('admin/settings', { admin, saved, err });
}

router.get('/settings', handleSettingsPage);
router.get('/settings/', handleSettingsPage);

router.post('/settings', async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body || {};
  const admin = await masterAdminRepository.findById(req.session.masterAdminId);
  if (!admin) return res.redirect('/panel/admin/login');
  const ok = await bcrypt.compare(current_password || '', admin.password_hash);
  if (!ok) return res.redirect('/panel/admin/settings?err=wrong');
  if (!new_password || new_password.length < 6) return res.redirect('/panel/admin/settings?err=short');
  if (new_password !== confirm_password) return res.redirect('/panel/admin/settings?err=mismatch');
  const hash = bcrypt.hashSync(new_password, 10);
  await masterAdminRepository.updatePassword(admin.id, hash);
  res.redirect('/panel/admin/settings?saved=1');
});

router.get('/sellers/new', (req, res) => {
  const err = req.query.err || null;
  res.render('admin/seller-form', { seller: null, err });
});

router.post('/sellers', async (req, res) => {
  const { slug, username, password, ccpu, query_channel, telegram_bot_token } = req.body || {};
  if (!slug || !username || !password) return res.redirect('/panel/admin/sellers/new?err=missing');
  const hash = bcrypt.hashSync(password, 10);
  const tokenVal = telegram_bot_token?.trim();
  const sellerId = await sellerRepository.create({
    slug: slug.trim(),
    username: username.trim(),
    passwordHash: hash,
    ccpu: parseInt(ccpu, 10) || 30,
    queryChannelEnabled: query_channel === '1',
    telegramBotToken: tokenVal || null,
  });
  if (sellerId && tokenVal) await setTelegramWebhook(sellerId, tokenVal);
  res.redirect('/panel/admin');
});

router.get('/sellers/:id/edit', async (req, res) => {
  const seller = await sellerRepository.findById(parseInt(req.params.id, 10));
  if (!seller) return res.redirect('/panel/admin');
  const saved = req.query.saved === '1';
  res.render('admin/seller-edit', { seller, saved });
});

router.post('/sellers/:id/edit', async (req, res) => {
  const sellerId = parseInt(req.params.id, 10);
  const seller = await sellerRepository.findById(sellerId);
  if (!seller) return res.redirect('/panel/admin');
  const { telegram_bot_token, telegram_username, ccpu, query_channel } = req.body || {};
  const tokenVal = telegram_bot_token?.trim();
  const newToken = tokenVal && !tokenVal.startsWith('••') ? tokenVal : (seller.telegram_bot_token || null);
  await sellerRepository.update(sellerId, {
    telegramBotToken: newToken,
    telegramUsername: telegram_username?.trim() || null,
    ccpu: parseInt(ccpu, 10) || seller.ccpu,
    queryChannelEnabled: query_channel === '1',
  });
  if (newToken) await setTelegramWebhook(sellerId, newToken);
  res.redirect(`/panel/admin/sellers/${sellerId}/edit?saved=1`);
});

router.post('/sellers/:id/suspend', async (req, res) => {
  const sellerId = parseInt(req.params.id, 10);
  const seller = await sellerRepository.findById(sellerId);
  if (!seller) return res.redirect('/panel/admin');
  const suspended = req.body?.suspended === '1';
  await sellerRepository.setSuspended(sellerId, suspended);
  res.redirect('/panel/admin');
});

router.get('/sellers/:id/credits', async (req, res) => {
  const seller = await sellerRepository.findById(req.params.id);
  if (!seller) return res.redirect('/panel/admin');
  const { data: ledger } = await getSupabase()
    .from('credit_ledger')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });
  const err = req.query.err || null;
  res.render('admin/credits', { seller, ledger: ledger || [], err });
});

router.post('/sellers/:id/credits', async (req, res) => {
  const { amount, reason } = req.body || {};
  const amountNum = parseInt(amount, 10);
  if (!amountNum) return res.redirect(`/panel/admin/sellers/${req.params.id}/credits?err=amount`);
  await sellerRepository.updateCredits(
    parseInt(req.params.id, 10),
    amountNum,
    reason?.trim() || 'Manual adjustment',
    req.session.masterAdminId
  );
  res.redirect(`/panel/admin/sellers/${req.params.id}/credits`);
});

export default router;
