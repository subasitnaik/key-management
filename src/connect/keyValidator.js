/**
 * Key validator for /connect compatibility layer.
 * Uses real backend (subscriptionService) for validation.
 */

import * as subscriptionService from '../services/subscriptionService.js';
import * as sellerRepository from '../repositories/sellerRepository.js';

/**
 * Resolve seller ID from slug or env.
 */
async function resolveSellerId(sellerSlug) {
  const slug = sellerSlug || process.env.SELLER_SLUG;
  if (!slug) {
    const all = await sellerRepository.getAll();
    const first = all[0];
    return first ? first.id : null;
  }
  const seller = await sellerRepository.findBySlug(slug);
  return seller ? seller.id : null;
}

/**
 * Validates key and device binding.
 * @param {Object} params
 * @param {string} params.key - The key (sent as password)
 * @param {string} params.uuid - Device identifier
 * @param {string} [params.sellerSlug] - Seller slug from URL path (optional)
 * @returns {Promise<{status: string, username?: string, expire?: string}>}
 */
export async function validateKey({ key, uuid, sellerSlug }) {
  const sellerId = await resolveSellerId(sellerSlug);
  if (!sellerId) return { status: 'notinlist' };

  return subscriptionService.validateKeyForConnect({ key, uuid, sellerId });
}
