/**
 * Payment approval service.
 */

import * as paymentRequestRepository from '../repositories/paymentRequestRepository.js';
import * as subscriptionService from './subscriptionService.js';
import * as sellerRepository from '../repositories/sellerRepository.js';
import * as planRepository from '../repositories/planRepository.js';

/**
 * Calculate credits consumed for a plan.
 * CCPU: credits per 30-day month. 7 days = 7/30 * ccpu
 */
export function creditsForPlan(plan, ccpu) {
  return Math.ceil((plan.days / 30) * ccpu);
}

/**
 * Accept payment: deduct credits, create subscription, assign key.
 */
export async function acceptPayment(paymentRequestId) {
  const pr = await paymentRequestRepository.findById(paymentRequestId);
  if (!pr || pr.status !== 'pending') return null;

  const seller = await sellerRepository.findById(pr.seller_id);
  const plan = await planRepository.findById(pr.plan_id);
  if (!seller || !plan) return null;

  const creditsNeeded = creditsForPlan(plan, seller.ccpu);
  if (seller.credits_balance < creditsNeeded) return { error: 'insufficient_credits' };

  await sellerRepository.updateCredits(pr.seller_id, -creditsNeeded, `Subscription for user ${pr.user_id}`, null);
  await paymentRequestRepository.updateStatus(paymentRequestId, 'accepted');
  await paymentRequestRepository.incrementSuccess(paymentRequestId);

  const result = await subscriptionService.createOrRenewSubscription(pr.user_id, pr.seller_id, pr.plan_id);
  if (!result) return { error: 'subscription_failed' };

  return {
    key: result.key,
    expiresAt: result.expiresAt,
    user: pr,
    plan,
  };
}
