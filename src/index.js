/**
 * Vercel Express entry (src/index.js). Export app so Vercel runs it as serverless.
 */
import { createApp } from '../app.js';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

export default createApp();
