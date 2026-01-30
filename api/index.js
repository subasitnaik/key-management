/**
 * Vercel serverless entry: all requests rewritten here. Path in ?path= for Express.
 * For /connect requests, read POST body and attach to req.body so Express gets key/uuid.
 */
import { createApp } from '../app.js';
import { parse } from 'url';

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

export default async function handler(req, res) {
  const parsed = parse(req.url || '/', true);
  const query = typeof req.query === 'object' && req.query !== null ? { ...req.query } : { ...parsed.query };
  const pathParam = query.path ?? parsed.query?.path;
  const path = pathParam ? '/' + String(pathParam).replace(/^\/+/, '') : '/';

  // For POST /connect/*, read body and attach so Express connect router gets key/uuid
  if (req.method === 'POST' && path.startsWith('/connect') && (req.readable || typeof req.on === 'function')) {
    try {
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body || {}).length === 0)) {
        const raw = await getRawBody(req);
        req.body = parseFormBody(raw);
      }
    } catch (e) {
      console.error('Connect body read error:', e);
    }
  }

  const q = { ...query };
  delete q.path;
  const qs = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
  req.url = path + qs;
  req.originalUrl = path + qs;
  return app(req, res);
}
