/**
 * Seller panel: Blocked users page — list, unblock one, unblock all.
 * Mount in sellerPanel.js: import sellerBlockedRouter from './sellerBlocked.js'; router.use(sellerBlockedRouter);
 * Paths: GET /panel/seller/blocked, POST /panel/seller/blocked/unblock/:userId, POST /panel/seller/blocked/unblock-all
 */

import { Router } from 'express';
import { requireSeller } from '../middleware/auth.js';
import { getBlockedBySeller, unblockUser, unblockAllBySeller } from '../repositories/blockedUserRepo.js';

const router = Router();

router.get('/blocked', requireSeller, async (req, res) => {
  const sellerId = req.session.sellerId;
  const blocked = await getBlockedBySeller(sellerId);
  res.render('seller/blocked', {
    blocked: blocked || [],
    unblocked: req.query.unblocked === '1',
    unblockedAll: req.query.unblocked_all === '1',
  });
});

router.post('/blocked/unblock/:userId', requireSeller, async (req, res) => {
  const sellerId = req.session.sellerId;
  const userId = parseInt(req.params.userId, 10);
  if (!userId) return res.redirect('/panel/seller/blocked');
  try {
    await unblockUser(userId, sellerId);
    return res.redirect(303, '/panel/seller/blocked?unblocked=1');
  } catch (e) {
    console.error('Unblock failed:', e?.message || e);
    return res.redirect('/panel/seller/blocked?error=1');
  }
});

router.post('/blocked/unblock-all', requireSeller, async (req, res) => {
  const sellerId = req.session.sellerId;
  try {
    await unblockAllBySeller(sellerId);
    return res.redirect(303, '/panel/seller/blocked?unblocked_all=1');
  } catch (e) {
    console.error('Unblock all failed:', e?.message || e);
    return res.redirect('/panel/seller/blocked?error=1');
  }
});

export default router;
