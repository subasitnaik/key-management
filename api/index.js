/**
 * Vercel serverless entry: all requests rewritten here. Path in ?path= for Express.
 * For POST /connect/* we handle here: read body once, run connect logic, return JSON (never pass to Express so stream isn't read twice).
 * GET /cron: Vercel Cron kicks expired users from private groups.
 */
import { createApp } from '../app.js';
import { parse } from 'url';
import { getSellerBySlug, getSellerById } from '../src/repositories/sellerRepo.js';
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

/** Finisher Tool (nlohmann json) throws type_error.302 if any key exists but is null. Never send null. */
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
  } else if (body.success === true && body.data) {
    const d = body.data;
    const rngNum = typeof d.rng === 'number' && !Number.isNaN(d.rng) ? d.rng : Math.floor(Date.now() / 1000);
    const expStr = d.EXP != null && d.EXP !== undefined ? String(d.EXP) : ' ';
    body = {
      success: true,
      reason: 'OK',
      data: {
        token: '1',
        rng: rngNum,
        EXP: expStr
      }
    };
  }
  const raw = JSON.stringify(body);
  res.setHeader('Content-Length', Buffer.byteLength(raw, 'utf8'));
  res.status(status).end(raw);
}

/** Kick expired users from private groups. Called by Vercel Cron. */
async function handleCron(req, res) {
  const isVercelCron = (req.headers?.['user-agent'] || '').includes('vercel-cron');
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.['authorization'] || '';
  const hasValidSecret = secret && auth === `Bearer ${secret}`;
  if (!isVercelCron && !hasValidSecret) {
    res.status(401).end('Unauthorized');
    return;
  }
  const now = new Date().toISOString();
  const { data: expired } = await getSupabase()
    .from('subscriptions')
    .select('id, user_id, seller_id')
    .lt('expires_at', now)
    .eq('expiry_kicked', 0);
  if (!expired?.length) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({ ok: true, kicked: 0 }));
    return;
  }
  let kicked = 0;
  for (const sub of expired) {
    const { data: user } = await getSupabase().from('users').select('telegram_user_id').eq('id', sub.user_id).single();
    const telegramId = user?.telegram_user_id;
    if (!telegramId || String(telegramId).startsWith('manual_')) continue;
    const seller = await getSellerById(sub.seller_id);
    if (!seller?.telegram_bot_token || !seller?.private_group_chat_id) continue;
    try {
      const chatId = seller.private_group_chat_id;
      const userId = parseInt(telegramId, 10);
      if (Number.isNaN(userId)) continue;
      const url = `https://api.telegram.org/bot${seller.telegram_bot_token}/banChatMember?chat_id=${chatId}&user_id=${userId}`;
      const r = await fetch(url);
      const json = await r.json();
      if (json.ok) kicked++;
    } catch (e) {
      console.error('Cron kick failed for sub', sub.id, e?.message || e);
    }
    await getSupabase().from('subscriptions').update({ expiry_kicked: 1 }).eq('id', sub.id);
  }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({ ok: true, kicked }));
}

async function handleConnect(req, res, path, query) {
  const slug = path.replace(/^\/connect\/?/, '').trim() || (query.slug && String(query.slug).trim());
  if (!slug) {
    connectSendJson(res, 400, { success: false, error: 'Missing slug' });
    return;
  }

  // Tool sends: query (?key=&uuid=) and/or body; Finisher Tool body format: game=PUBG&user_key=%s&serial=%s
  let key = (query.key ?? query.Key ?? query.user_key ?? '').toString().trim();
  let uuid = (query.uuid ?? query.UUID ?? query.serial ?? query.Serial ?? '').toString().trim();
  if (!key || !uuid) {
    let raw = '';
    try {
      if (req.body && typeof req.body === 'string') raw = req.body;
      else if (req.body && typeof req.body === 'object') {
        const b = req.body;
        key = (b.key ?? b.Key ?? b.user_key ?? key).toString().trim();
        uuid = (b.uuid ?? b.UUID ?? b.serial ?? b.Serial ?? uuid).toString().trim();
      }
      if (!key || !uuid) {
        if (typeof req.text === 'function') raw = raw || await req.text();
        else if (typeof req.on === 'function') raw = raw || await getRawBody(req);
      }
    } catch (e) {
      console.error('Connect body read error:', e);
    }
    if (raw) {
      const body = parseFormBody(raw);
      key = (body.key ?? body.Key ?? body.user_key ?? key).toString().trim();
      uuid = (body.uuid ?? body.UUID ?? body.serial ?? uuid).toString().trim();
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

    // Support max_devices: store multiple UUIDs comma-separated in subscriptions.uuid
    const maxDevices = Math.max(1, parseInt(sub.max_devices, 10) || 1);
    const currentUuids = (sub.uuid || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (uuid) {
      const alreadyAllowed = currentUuids.includes(uuid);
      if (!alreadyAllowed && currentUuids.length >= maxDevices) {
        connectSendJson(res, 403, { success: false, error: 'Device limit reached' });
        return;
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

  if (req.method === 'GET' && (path === '/cron' || path === '/api/cron')) {
    return handleCron(req, res);
  }
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
