/**
 * Vercel serverless entry: all requests rewritten here. Path in ?path= for Express.
 * Do NOT read the request stream here — Express body-parser must read it, or we get "stream is not readable".
 * Only copy req.body / req.text() into _incomingBody when Vercel/Web API already provided body (no stream read).
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

export default async function handler(req, res) {
  const parsed = parse(req.url || '/', true);
  const query = typeof req.query === 'object' && req.query !== null ? { ...req.query } : { ...parsed.query };
  const pathParam = query.path ?? parsed.query?.path;
  const path = pathParam ? '/' + String(pathParam).replace(/^\/+/, '') : '/';

  // If Vercel or Web API already set body (no stream read), preserve for Express so urlencoded doesn't overwrite.
  if (req.method === 'POST' && path.startsWith('/connect')) {
    try {
      if (req.body && typeof req.body === 'object' && (req.body.key ?? req.body.Key ?? req.body.uuid !== undefined)) {
        req._incomingBody = req.body;
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        req._incomingBody = parseFormBody(req.body);
      } else if (typeof req.text === 'function') {
        const raw = await req.text();
        if (raw && raw.length > 0) req._incomingBody = parseFormBody(raw);
      }
    } catch (e) {
      console.error('Connect body preserve error:', e);
    }
  }

  const q = { ...query };
  delete q.path;
  const qs = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
  req.url = path + qs;
  req.originalUrl = path + qs;
  return app(req, res);
}
