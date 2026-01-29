/**
 * Vercel entry: must import express so Vercel detects Express app. Set "Root Directory" to backend in Vercel.
 */
import express from 'express';
import { createApp } from './app.js';

// Log unhandled rejections so they appear in Vercel logs
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

let app;
try {
  app = createApp();
} catch (err) {
  console.error('createApp failed:', err?.message || err);
  app = express();
  app.use((req, res) => {
    res.status(500).json({
      error: 'Startup failed',
      message: err?.message || String(err),
    });
  });
}

export default app;
