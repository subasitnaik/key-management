/**
 * Vercel serverless entry: all requests rewritten here. Path in ?path= for Express.
 */
import { createApp } from '../app.js';
import { parse } from 'url';

process.on('unhandledRejection', (r, p) => console.error('Unhandled Rejection at', p, r));

const app = createApp();

export default function handler(req, res) {
  const parsed = parse(req.url || '/', true);
  // Vercel may expose query on req.query for POST; fallback to parsed.query from req.url
  const query = typeof req.query === 'object' && req.query !== null ? { ...req.query } : { ...parsed.query };
  const pathParam = query.path ?? parsed.query?.path;
  const path = pathParam ? '/' + String(pathParam).replace(/^\/+/, '') : '/';
  const q = { ...query };
  delete q.path;
  const qs = Object.keys(q).length ? '?' + new URLSearchParams(q).toString() : '';
  req.url = path + qs;
  req.originalUrl = path + qs;
  return app(req, res);
}
