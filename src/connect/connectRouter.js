/**
 * /connect compatibility router.
 * Auth endpoint IS the base URL. Tool POSTs directly here.
 * Supports: /connect/ or /connect/:sellerSlug/
 * Response format: plain text (NOT JSON). Same as legacy panels.
 */

import express from 'express';
import { validateKey } from './keyValidator.js';

const router = express.Router({ mergeParams: true });
const authHandler = express.urlencoded({ extended: true });

async function handleAuth(req, res) {
  const password = (req.body?.password ?? '').trim();
  const uuid = (req.body?.uuid ?? '').trim();
  const sellerSlug = req.params.sellerSlug || null;

  const result = await validateKey({
    key: password,
    uuid,
    sellerSlug,
  });

  res.set('Content-Type', 'text/plain; charset=utf-8');

  if (result.status === 'success') {
    const body = [
      'loginisdone',
      `【username】${result.username}【username】`,
      `;${result.expire};`,
    ].join('\n');
    return res.send(body);
  }

  res.send(result.status);
}

router.get(/^\/?$/, (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(
    'Connect auth endpoint.\n\n' +
      'The tool POSTs here with:\n' +
      '  - password (the key) — required\n' +
      '  - uuid (device ID) — required, used for device limit logic\n\n' +
      'Username is NOT required. Validation is by key + uuid only.\n' +
      'Use POST, not GET.'
  );
});

router.post(/^\/?$/, authHandler, handleAuth);

export default router;
