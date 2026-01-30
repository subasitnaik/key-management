/**
 * Connect API for Android tools (Finisher Tool, PRESIDENT Tool).
 * POST /connect/:slug with body key=...&uuid=... (application/x-www-form-urlencoded).
 * Returns JSON: success => { success: true, data: { token, rng [, EXP ] } }, error => { success: false, error: "..." }.
 */

import { Router } from 'express';
import { getSellerBySlug } from '../repositories/sellerRepo.js';
import { getSupabase } from '../db/supabase.js';

const router = Router();

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
}

/**
 * POST /connect/:slug
 * Body: key=...&uuid=... (form-urlencoded)
 * Success: { success: true, data: { token: string, rng: number [, EXP: string ] } }
 * - rng = server Unix timestamp (tool checks rng + 30 > time(0))
 * - EXP optional for PRESIDENT (e.g. expires_at as string)
 * Error: { success: false, error: string }
 */
router.post('/:slug', async (req, res) => {
  try {
    const slug = (req.params.slug || '').trim();
    if (!slug) {
      return sendJson(res, 400, { success: false, error: 'Missing slug' });
    }

    const key = (req.body?.key ?? req.body?.Key ?? '').toString().trim();
    const uuid = (req.body?.uuid ?? req.body?.UUID ?? '').toString().trim();

    if (!key) {
      return sendJson(res, 400, { success: false, error: 'Invalid key' });
    }

    const seller = await getSellerBySlug(slug);
    if (!seller) {
      return sendJson(res, 404, { success: false, error: 'Invalid link' });
    }

    if (seller.suspended) {
      return sendJson(res, 403, { success: false, error: 'Seller suspended' });
    }

    if (seller.maintenance_mode) {
      return sendJson(res, 503, { success: false, error: 'Under maintenance' });
    }

    const { data: sub, error: subError } = await getSupabase()
      .from('subscriptions')
      .select('id, key, uuid, max_devices, expires_at, maintenance_paused_at')
      .eq('seller_id', seller.id)
      .eq('key', key)
      .maybeSingle();

    if (subError) {
      console.error('Connect subscription lookup error:', subError);
      return sendJson(res, 500, { success: false, error: 'Server error' });
    }

    if (!sub) {
      return sendJson(res, 403, { success: false, error: 'Invalid key' });
    }

    const now = new Date();
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    if (expiresAt && expiresAt <= now) {
      return sendJson(res, 403, { success: false, error: 'Key expired' });
    }

    if (sub.maintenance_paused_at) {
      return sendJson(res, 503, { success: false, error: 'Under maintenance' });
    }

    const maxDevices = Math.max(1, parseInt(sub.max_devices, 10) || 1);
    const currentUuid = (sub.uuid || '').trim();

    if (uuid) {
      if (currentUuid && currentUuid !== uuid) {
        if (maxDevices <= 1) {
          return sendJson(res, 403, { success: false, error: 'Device limit reached' });
        }
        // Multi-device: could allow multiple UUIDs; schema has single uuid - treat as one device for now
        return sendJson(res, 403, { success: false, error: 'Device limit reached' });
      }
      if (!currentUuid) {
        await getSupabase()
          .from('subscriptions')
          .update({ uuid })
          .eq('id', sub.id);
      }
    }

    const rng = Math.floor(Date.now() / 1000);
    const data = {
      token: '1',
      rng
    };
    if (expiresAt) {
      data.EXP = expiresAt.toISOString ? expiresAt.toISOString() : String(expiresAt);
    }

    return sendJson(res, 200, { success: true, data });
  } catch (err) {
    console.error('Connect error:', err);
    return sendJson(res, 500, { success: false, error: 'Server error' });
  }
});

/**
 * GET /connect/:slug - return JSON error (tools use POST only)
 */
router.get('/:slug', (req, res) => {
  sendJson(res, 405, { success: false, error: 'Use POST with key and uuid' });
});

export default router;
