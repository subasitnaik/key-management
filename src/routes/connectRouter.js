/**
 * Connect API for Android tools (Finisher Tool, PRESIDENT Tool).
 * POST /connect/:slug with body key=...&uuid=... (application/x-www-form-urlencoded).
 * Always returns JSON. Tool expects error under "reason" and safe "data" to avoid parse crashes.
 */

import express from 'express';
import { Router } from 'express';
import { getSellerBySlug } from '../repositories/sellerRepo.js';
import { getSupabase } from '../db/supabase.js';

const router = Router();

/** Preserve body before any parser (Vercel may set req.body before Express). */
router.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    req._connectBody = { ...req.body };
  }
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    req._connectRawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  }
  next();
});

/** When body is still missing, read raw stream (Vercel/Express may leave body in stream). */
router.use((req, res, next) => {
  if (req._connectBody || req._connectRawBody) return next();
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') return next();
  if (!req.readable || typeof req.on !== 'function') return next();
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req._connectRawBody = Buffer.concat(chunks).toString('utf8');
    next();
  });
  req.on('error', (err) => {
    console.error('Connect body stream error:', err);
    next();
  });
});

router.use(express.urlencoded({ extended: true }));

/** Error payload: tool reads result["reason"]. Include safe data to avoid tool crash. */
function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  if (body.success === false) {
    const errStr = typeof body.error === 'string' ? body.error : 'Error';
    const data = body.data && body.data.token !== undefined ? body.data : {};
    const tokenStr = (data.token != null && data.token !== '') ? String(data.token) : ' ';
    const expStr = (data.EXP != null && data.EXP !== '') ? String(data.EXP) : ' ';
    body = {
      success: false,
      reason: errStr,
      error: errStr,
      Error: errStr,
      message: errStr,
      Message: errStr,
      err: errStr,
      msg: errStr,
      data: {
        token: tokenStr,
        Token: tokenStr,
        rng: typeof data.rng === 'number' ? data.rng : 0,
        EXP: expStr,
        exp: expStr,
        Exp: expStr
      }
    };
  }
  res.status(status).end(JSON.stringify(body));
}

/** Parse form string "key=val&uuid=val2" into object */
function parseFormBody(str) {
  const out = {};
  if (typeof str !== 'string') return out;
  for (const part of str.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' ')).trim();
    const v = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' ')).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** Get key and uuid from req.body, _incomingBody (api/index), preserved body, raw body, or query. */
function getKeyAndUuid(req) {
  let body = req.body && typeof req.body === 'object' ? req.body : {};
  if (Object.keys(body).length === 0 && req._incomingBody && typeof req._incomingBody === 'object') {
    body = req._incomingBody;
  }
  if (Object.keys(body).length === 0 && req._connectBody) {
    body = req._connectBody;
  }
  if (Object.keys(body).length === 0 && (typeof req.body === 'string' || req._connectRawBody)) {
    body = { ...body, ...parseFormBody(req._connectRawBody || req.body || '') };
  }
  const key = (body.key ?? body.Key ?? body.password ?? body.Password ?? req.query?.key ?? req.query?.Key ?? '').toString().trim();
  const uuid = (body.uuid ?? body.UUID ?? req.query?.uuid ?? req.query?.UUID ?? '').toString().trim();
  return { key, uuid };
}

router.post('/:slug?', async (req, res) => {
  try {
    const slug = (req.params.slug ?? '').trim();
    if (!slug) {
      return sendJson(res, 400, { success: false, error: 'Missing slug' });
    }

    const { key, uuid } = getKeyAndUuid(req);

    if (!key) {
      return sendJson(res, 400, { success: false, error: 'Missing key' });
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
    const currentUuids = (sub.uuid || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (uuid) {
      const alreadyAllowed = currentUuids.includes(uuid);
      if (!alreadyAllowed && currentUuids.length >= maxDevices) {
        return sendJson(res, 403, { success: false, error: 'Device limit reached' });
      }
      if (!alreadyAllowed) {
        currentUuids.push(uuid);
        await getSupabase()
          .from('subscriptions')
          .update({ uuid: currentUuids.join(',') })
          .eq('id', sub.id);
      }
    }

    const rng = Math.floor(Date.now() / 1000);
    const data = {
      token: '1',
      rng,
      EXP: expiresAt ? (expiresAt.toISOString ? expiresAt.toISOString() : String(expiresAt)) : ' '
    };

    return sendJson(res, 200, { success: true, data });
  } catch (err) {
    console.error('Connect error:', err);
    return sendJson(res, 500, { success: false, error: 'Server error' });
  }
});

router.get('/:slug?', (req, res) => {
  sendJson(res, 405, { success: false, error: 'Use POST with key and uuid' });
});

router.use((_req, res) => {
  sendJson(res, 404, { success: false, error: 'Not found' });
});

export default router;
