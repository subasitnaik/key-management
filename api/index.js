/**
 * Vercel serverless entry: all requests rewritten here. Original path in ?path= for Express.
 */
import { createApp } from '../app.js';
import { parse } from 'url';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

const app = createApp();

export default function handler(req, res) {
  const parsed = parse(req.url || '/', true);
  const pathQuery = parsed.query && parsed.query.path;
  const path = pathQuery ? '/' + String(pathQuery).replace(/^\/+/, '') : '/';
  const query = { ...parsed.query };
  delete query.path;
  const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
  req.url = path + qs;
  req.originalUrl = path + qs;
  return app(req, res);
}
