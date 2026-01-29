/**
 * /connect and /connect/:sellerSlug — key validation for the tool.
 * GET or POST: key (required), uuid (optional). Lazy expiry check per request.
 */

import { Router } from 'express';
import { getSellerBySlug } from '../repositories/sellerRepo.js';
import { validateKeyForConnect } from '../repositories/subscriptionRepo.js';

const router = Router();

router.all(['/','/:sellerSlug'], async (req, res) => {
  try {
    const slug = req.params.sellerSlug || req.query.sellerSlug || req.body?.sellerSlug;
    const key = req.query.key || req.body?.key || req.query.password || req.body?.password;
    const uuid = req.query.uuid || req.body?.uuid;

    if (!key || (typeof key === 'string' && !key.trim())) {
      return res.status(400).send('notinlist');
    }
    const keyStr = String(key).trim();

    let sellerId = null;
    if (slug) {
      const seller = await getSellerBySlug(String(slug).trim());
      if (!seller) return res.status(200).send('notinlist');
      sellerId = seller.id;
    } else {
      const result = await validateKeyForConnect(keyStr, null);
      if (result.status === 'ok') {
        return res.status(200).send('loginisdone');
      }
      if (result.status === 'expired') return res.status(200).send('expired');
      if (result.status === 'maintenance') return res.status(200).send('maintenance');
      return res.status(200).send('notinlist');
    }

    const result = await validateKeyForConnect(keyStr, sellerId);
    if (result.status === 'ok') return res.status(200).send('loginisdone');
    if (result.status === 'expired') return res.status(200).send('expired');
    if (result.status === 'maintenance') return res.status(200).send('maintenance');
    return res.status(200).send('notinlist');
  } catch (err) {
    console.error('Connect error:', err);
    return res.status(500).send('error');
  }
});

export default router;
