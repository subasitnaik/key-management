/**
 * Express app factory. Serverless-compatible: no background jobs, no long-running state.
 * Session in cookie (cookie-session). Subscription expiry evaluated lazily on each /connect request.
 */

import 'dotenv/config';
import express from 'express';
import cookieSession from 'cookie-session';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { initDb } from './db/index.js';
import connectRouter from './connect/connectRouter.js';
import sellerPanel from './routes/sellerPanel.js';
import adminPanel, { handleSettingsPage } from './routes/adminPanel.js';
import { requireMasterAdmin } from './middleware/auth.js';
import paymentApi from './routes/api/paymentApi.js';
import telegramWebhook from './routes/api/telegramWebhook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let dbInitPromise = null;

/**
 * Create and configure the Express app. Sync so Vercel can use default export.
 * initDb runs lazily on first request (once per process).
 */
export function createApp() {
  const app = express();

  // Health check first (no DB) so we can see if the function runs at all
  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use((req, res, next) => {
    const url = (process.env.SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) {
      return next(new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set them in Vercel → Project Settings → Environment Variables (Production).'));
    }
    if (dbInitPromise) return dbInitPromise.then(() => next()).catch(next);
    dbInitPromise = initDb();
    dbInitPromise.then(() => next()).catch(next);
  });
  app.set('view engine', 'ejs');
  // Views path: cwd works on Vercel (deployment root); __dirname fallback for local
  const viewsCwd = join(process.cwd(), 'views');
  const viewsDirname = join(__dirname, '..', 'views');
  app.set('views', existsSync(viewsCwd) ? viewsCwd : viewsDirname);

  // Serverless-compatible session: stored in signed cookie (no server-side store)
  app.use(
    cookieSession({
      name: 'session',
      keys: [process.env.SESSION_SECRET || 'change-me-in-production'],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  );

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use('/connect', connectRouter);
  app.use('/connect/:sellerSlug', connectRouter);

  app.use('/panel/seller', sellerPanel);
  app.get('/panel/admin/settings', requireMasterAdmin, handleSettingsPage);
  app.get('/panel/admin/settings/', requireMasterAdmin, handleSettingsPage);
  app.use('/panel/admin', adminPanel);
  app.use('/api/payment', paymentApi);
  app.use('/api/telegram/webhook', telegramWebhook);

  // Error handler so crashes return a message (and show in Vercel logs)
  app.use((err, req, res, next) => {
    console.error('Server error:', err?.message || err);
    const msg = err?.message || 'Server error';
    const isEnvError = /SUPABASE|SESSION_SECRET|env/i.test(msg);
    res.status(isEnvError ? 503 : 500).json({
      error: isEnvError ? 'Configuration error' : 'Server error',
      message: msg,
    });
  });

  return app;
}

// Vercel uses src/app.js as entry; it requires a default export (function or server)
export default createApp();
