/**
 * Connect API: key validation for Android/tools.
 * POST /connect/:slug with body { key, uuid } (JSON or application/x-www-form-urlencoded).
 * Always returns JSON so the tool never gets HTML or plain "no"/"Not Found" (which cause parse_error.101).
 *
 * Tool contract (e.g. Login.h):
 * - Request: POST, Content-Type application/json or form, body: key=<license_key>, uuid=<device_uuid>
 * - Success: { "status": true, "data": { "token": "...", "rng": <unix_ts>, "EXP": "<expiry_str>" } }
 * - Failure: { "status": false, "message": "<error>" }
 */

import { Router } from 'express';
import { getSellerBySlug } from '../repositories/sellerRepo.js';
import { getSupabase } from '../db/supabase.js';

const router = Router();

const JSON_HEADER = { 'Content-Type': 'application/json; charset=utf-8' };

function parseKeyAndUuid(req) {
  const body = req.body || {};
  let key = body.key ?? body.Key ?? req.query?.key;
  let uuid = body.uuid ?? body.UUID ?? body.Uuid ?? req.query?.uuid;
  if (typeof key === 'string') key = key.trim();
  if (typeof uuid === 'string') uuid = uuid.trim();
  return { key, uuid };
}

function sendError(res, message, statusCode = 200) {
  res.set(JSON_HEADER);
  res.status(statusCode).json({
    status: false,
    success: false,
    valid: false,
    message: message || 'Invalid request',
  });
}

function sendSuccess(res, data) {
  res.set(JSON_HEADER);
  res.status(200).json({
    status: true,
    success: true,
    valid: true,
    data: {
      token: data.token,
      rng: data.rng,
      EXP: data.EXP,
    },
  });
}

// GET /connect/:slug -> always JSON (avoids 404 HTML "Not Found" which causes parse_error.101 in tool)
router.get('/:slug', (req, res) => {
  res.set(JSON_HEADER);
  res.status(200).json({
    status: false,
    success: false,
    valid: false,
    message: 'Use POST with key and uuid in body',
  });
});

router.post('/:slug', async (req, res) => {
  try {
    const slug = (req.params.slug || '').trim();
    if (!slug) return sendError(res, 'Missing slug');

    const { key, uuid } = parseKeyAndUuid(req);
    if (!key) return sendError(res, 'Missing key');

    const seller = await getSellerBySlug(slug);
    if (!seller) return sendError(res, 'Invalid link');

    const { data: sub, error: subErr } = await getSupabase()
      .from('subscriptions')
      .select('id, key, uuid, expires_at, max_devices, maintenance_paused_at')
      .eq('seller_id', seller.id)
      .eq('key', key)
      .maybeSingle();

    if (subErr) {
      console.error('Connect lookup error:', subErr);
      return sendError(res, 'Server error');
    }
    if (!sub) return sendError(res, 'Invalid key');

    const now = new Date();
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    if (expiresAt && expiresAt <= now) return sendError(res, 'Key expired');

    if (sub.maintenance_paused_at) return sendError(res, 'Service temporarily paused');

    const existingUuid = (sub.uuid || '').trim();
    if (existingUuid && uuid && existingUuid !== uuid) {
      const maxDevices = Math.max(1, parseInt(sub.max_devices, 10) || 1);
      if (maxDevices <= 1) return sendError(res, 'Key in use on another device');
      return sendError(res, 'Key in use on another device');
    }

    if (uuid && !existingUuid) {
      await getSupabase()
        .from('subscriptions')
        .update({ uuid: uuid })
        .eq('id', sub.id);
    }

    const rng = Math.floor(now.getTime() / 1000);
    const EXP = expiresAt
      ? expiresAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    return sendSuccess(res, {
      token: key,
      rng,
      EXP,
    });
  } catch (e) {
    console.error('Connect error:', e?.message || e);
    if (!res.headersSent) sendError(res, 'Server error');
  }
});

export default router;
