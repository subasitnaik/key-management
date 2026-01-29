/**
 * Subscription and key service.
 */

import * as subscriptionRepository from '../repositories/subscriptionRepository.js';
import * as planRepository from '../repositories/planRepository.js';
import * as sellerRepository from '../repositories/sellerRepository.js';
import { generateKey } from '../utils/keygen.js';

/**
 * Validate key for /connect endpoint.
 */
export async function validateKeyForConnect({ key, uuid, sellerId }) {
  const seller = await sellerRepository.findById(sellerId);
  if (!seller) return { status: 'notinlist' };

  if (seller.maintenance_mode) {
    return { status: 'expired' };
  }

  const sub = await subscriptionRepository.findByKey(key, sellerId);
  if (!sub) return { status: 'notinlist' };

  const now = new Date();
  let expiresAt = new Date(sub.expires_at);

  if (now > expiresAt) return { status: 'expired' };

  const maxDevices = sub.max_devices ?? 1;
  const uuidList = (sub.uuid || '').split(',').filter(Boolean);

  if (uuidList.includes(uuid)) {
    // Device already registered, allow
  } else if (uuidList.length < maxDevices && uuid) {
    if (maxDevices === 1) {
      await subscriptionRepository.updateUuid(sub.id, uuid);
    } else {
      await subscriptionRepository.addUuidToList(sub.id, uuid);
    }
  } else if (uuid && !uuidList.includes(uuid)) {
    return { status: 'notregistered' };
  }

  const expireStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
  return {
    status: 'success',
    username: sub.user_username || `user${sub.user_id}`,
    expire: expireStr,
  };
}

/**
 * Create or renew subscription for user.
 */
export async function createOrRenewSubscription(userId, sellerId, planId) {
  const plan = await planRepository.findById(planId);
  if (!plan || plan.seller_id !== sellerId) return null;

  let sub = await subscriptionRepository.findByUserAndSeller(userId, sellerId);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + plan.days);

  if (sub) {
    const currentExpiry = new Date(sub.expires_at);
    const baseExpiry = sub.maintenance_paused_at ? new Date(sub.maintenance_paused_at) : currentExpiry;
    const newExpiry = baseExpiry > now ? baseExpiry : now;
    newExpiry.setDate(newExpiry.getDate() + plan.days);
    await subscriptionRepository.extendExpiry(sub.id, newExpiry.toISOString().slice(0, 19).replace('T', ' '));
    return { key: sub.key, expiresAt: newExpiry };
  }

  const key = generateKey(12);
  await subscriptionRepository.create({
    userId,
    sellerId,
    key,
    expiresAt: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
  });
  return { key, expiresAt };
}
