/**
 * Vercel serverless entry: all requests rewritten here. Path in ?path= for Express.
 * For POST /connect/* we handle here: read body once, run connect logic, return JSON (never pass to Express so stream isn't read twice).
 */
import { createApp } from '../app.js';
import { parse } from 'url';
import { getSellerBySlug } from '../src/repositories/sellerRepo.js';
import { getSupabase } from '../src/db/supabase.js';

process.on('unhandledRejection', (r, p) => console.error('Unhandled Rejection at', p, r));

const app = createApp();

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

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function connectSendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  if (body.success === false) {
    const errStr = typeof body.error === 'string' ? body.error : 'Error';
    body = {
      success: false,
      reason: errStr,
      error: errStr,
      data: { token: ' ', rng: 0, EXP: ' ' }
    };
  }
  res.status(status).end(JSON.stringify(body));
}

async function handleConnect(req, res, path, query) {
  const slug = path.replace(/^\/connect\/?/, '').trim() || (query.slug && String(query.slug).trim());
  if (!slug) {
    connectSendJson(res, 400, { success: false, error: 'Missing slug' });
    return;
  }

  let key = (query.key ?? query.Key ?? '').toString().trim();
  let uuid = (query.uuid ?? query.UUID ?? '').toString().trim();
  if (!key || !uuid) {
    let raw = '';
    try {
      if (req.body && typeof req.body === 'string') raw = req.body;
      else if (req.body && typeof req.body === 'object' && (req.body.key ?? req.body.Key)) {
        key = (req.body.key ?? req.body.Key ?? key).toString().trim();
        uuid = (req.body.uuid ?? req.body.UUID ?? uuid).toString().trim();
      } else if (typeof req.text === 'function') raw = await req.text();
      else if (typeof req.on === 'function') raw = await getRawBody(req);
    } catch (e) {
      console.error('Connect body read error:', e);
    }
    if (raw) {
      const body = parseFormBody(raw);
      key = (body.key ?? body.Key ?? key).toString().trim();
      uuid = (body.uuid ?? body.UUID ?? uuid).toString().trim();
    }
  }

  if (!key) {
    connectSendJson(res, 400, { success: false, error: 'Missing key' });
    return;
  }

  try {
    const seller = await getSellerBySlug(slug);
    if (!seller) {
      connectSendJson(res, 404, { success: false, error: 'Invalid link' });
      return;
    }
    if (seller.suspended) {
      connectSendJson(res, 403, { success: false, error: 'Seller suspended' });
      return;
    }
    if (seller.maintenance_mode) {
      connectSendJson(res, 503, { success: false, error: 'Under maintenance' });
      return;
    }

    const { data: sub, error: subError } = await getSupabase()
      .from('subscriptions')
      .select('id, key, uuid, max_devices, expires_at, maintenance_paused_at')
      .eq('seller_id', seller.id)
      .eq('key', key)
      .maybeSingle();

    if (subError) {
      console.error('Connect subscription lookup error:', subError);
      connectSendJson(res, 500, { success: false, error: 'Server error' });
      return;
    }
    if (!sub) {
      connectSendJson(res, 403, { success: false, error: 'Invalid key' });
      return;
    }

    const now = new Date();
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    if (expiresAt && expiresAt <= now) {
      connectSendJson(res, 403, { success: false, error: 'Key expired' });
      return;
    }
    if (sub.maintenance_paused_at) {
      connectSendJson(res, 503, { success: false, error: 'Under maintenance' });
      return;
    }

    const currentUuid = (sub.uuid || '').trim();
    if (uuid) {
      if (currentUuid && currentUuid !== uuid) {
        connectSendJson(res, 403, { success: false, error: 'Device limit reached' });
        return;
      }
      if (!currentUuid) {
        await getSupabase().from('subscriptions').update({ uuid }).eq('id', sub.id);
      }
    }

    const rng = Math.floor(Date.now() / 1000);
    const data = {
      token: '1',
      rng,
      EXP: expiresAt ? (expiresAt.toISOString ? expiresAt.toISOString() : String(expiresAt)) : ' '
    };
    connectSendJson(res, 200, { success: true, data });
  } catch (err) {
    console.error('Connect error:', err);
    connectSendJson(res, 500, { success: false, error: 'Server error' });
  }
}

export default async function handler(req, res) {
  const parsed = parse(req.url || '/', true);
  const query = typeof req.query === 'object' && req.query !== null ? { ...req.query } : { ...parsed.query };
  const pathParam = query.path ?? parsed.query?.path;
  const path = pathParam ? '/' + String(pathParam).replace(/^\/+/, '') : '/';

  if (req.method === 'POST' && path.startsWith('/connect')) {
    return handleConnect(req, res, path, query);
  }

  const q = { ...query };
  delete q.path;
  const qs = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
  req.url = path + qs;
  req.originalUrl = path + qs;
  return app(req, res);
}
