/**
 * Key generation utility.
 * Keys can be arbitrary strings (no cryptographic format required).
 */

import { randomBytes } from 'crypto';

export function generateKey(length = 16) {
  return randomBytes(length).toString('hex').toUpperCase();
}

export function generateCustomKey() {
  return generateKey(12);
}
