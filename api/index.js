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

  // For POST /connect/*, get body so Express connect router gets key/uuid.
  // Try: Vercel req.body, then req.text(), then Node stream. Preserve in _incomingBody for Express.
  if (req.method === 'POST' && path.startsWith('/connect')) {
    try {
      let parsed = null;
      if (req.body && typeof req.body === 'object' && (req.body.key ?? req.body.Key ?? req.body.uuid !== undefined)) {
        parsed = req.body;
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        parsed = parseFormBody(req.body);
      } else if (typeof req.text === 'function') {
        const raw = await req.text();
        parsed = parseFormBody(raw || '');
      } else if (typeof req.on === 'function') {
        const raw = await getRawBody(req);
        parsed = parseFormBody(raw || '');
      }
      if (parsed && typeof parsed === 'object') {
        req.body = parsed;
        req._incomingBody = parsed;
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
