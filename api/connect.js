/**
 * Vercel serverless handler for POST /api/connect (and /connect/:slug via rewrite).
 * Rewrite sends /connect/:slug -> /api/connect?slug=:slug so slug is in req.query.
 * Vercel parses req.body for form-urlencoded, so key/uuid are available here.
 */

import { getSellerBySlug } from '../src/repositories/sellerRepo.js';
import { getSupabase } from '../src/db/supabase.js';

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

function getKeyAndUuid(req) {
  let body = req.body && typeof req.body === 'object' ? req.body : {};
  if (Object.keys(body).length === 0 && typeof req.body === 'string') {
    body = parseFormBody(req.body);
  }
  const key = (body.key ?? body.Key ?? body.password ?? body.Password ?? req.query?.key ?? req.query?.Key ?? '').toString().trim();
  const uuid = (body.uuid ?? body.UUID ?? req.query?.uuid ?? req.query?.UUID ?? '').toString().trim();
  return { key, uuid };
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  if (body.success === false) {
    const errStr = typeof body.error === 'string' ? body.error : 'Error';
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
        token: ' ',
        Token: ' ',
        rng: 0,
        EXP: ' ',
        exp: ' ',
        Exp: ' '
      }
    };
  }
  res.status(status).end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 405, { success: false, error: 'Use POST with key and uuid' });
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const slug = (req.query?.slug ?? '').trim();
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

    const currentUuid = (sub.uuid || '').trim();

    if (uuid) {
      if (currentUuid && currentUuid !== uuid) {
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
    console.error('Connect API error:', err);
    return sendJson(res, 500, { success: false, error: 'Server error' });
  }
}
