/**
 * Express app (at repo root so Vercel can find it). Imports from ./src/...
 */
import 'dotenv/config';
import express from 'express';
import cookieSession from 'cookie-session';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { initDb } from './src/db/index.js';
import connectRouter from './src/connect/connectRouter.js';
import sellerPanel from './src/routes/sellerPanel.js';
import adminPanel, { handleSettingsPage } from './src/routes/adminPanel.js';
import { requireMasterAdmin } from './src/middleware/auth.js';
import paymentApi from './src/routes/api/paymentApi.js';
import telegramWebhook from './src/routes/api/telegramWebhook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let dbInitPromise = null;

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.get('/health', (req, res) => res.json({ ok: true }));

  const publicDir = join(__dirname, 'public');
  app.get('/styles.css', (req, res) => {
    const file = join(publicDir, 'styles.css');
    if (!existsSync(file)) return res.status(404).end();
    res.type('text/css').send(readFileSync(file, 'utf8'));
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
  const viewsCwd = join(process.cwd(), 'views');
  const viewsDirname = join(__dirname, 'views');
  app.set('views', existsSync(viewsCwd) ? viewsCwd : viewsDirname);

  app.use(
    cookieSession({
      name: 'session',
      keys: [process.env.SESSION_SECRET || 'change-me-in-production'],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    })
  );

  // Preserve Vercel-pre-parsed body so Express urlencoded doesn't overwrite with empty {}
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      req._incomingBody = req.body;
    }
    next();
  });
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use((req, res, next) => {
    if (req._incomingBody && (!req.body || Object.keys(req.body).length === 0)) {
      req.body = req._incomingBody;
    }
    next();
  });

  app.use('/connect', connectRouter);
  app.use('/connect/:sellerSlug', connectRouter);
  app.use('/panel/seller', sellerPanel);
  app.get('/panel/admin/settings', requireMasterAdmin, handleSettingsPage);
  app.get('/panel/admin/settings/', requireMasterAdmin, handleSettingsPage);
  app.use('/panel/admin', adminPanel);
  app.use('/api/payment', paymentApi);
  app.use('/api/telegram/webhook', telegramWebhook);

  app.get('/', (req, res) => res.redirect('/panel/admin'));

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

export default createApp();
