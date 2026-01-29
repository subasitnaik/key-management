/**
 * Register Telegraf handlers: start (plans), photo (payment screenshot), callback (accept/reject/block).
 */

import { Telegraf, Markup } from 'telegraf';
import { getPlansBySeller } from '../repositories/planRepo.js';
import { getSellerById } from '../repositories/sellerRepo.js';
import { findOrCreateUserByTelegram } from '../repositories/userRepo.js';
import { createPaymentRequest, getPaymentRequestById, updatePaymentRequest } from '../repositories/paymentRequestRepo.js';
import { isBlocked, blockUser } from '../repositories/blockedUserRepo.js';
import { addLedgerEntry } from '../repositories/creditLedgerRepo.js';
import { getSupabase } from '../db/supabase.js';

function generateKey() {
  return 'key_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function registerBotHandlers(bot, sellerId) {
  bot.start(async (ctx) => {
    const plans = await getPlansBySeller(sellerId);
    if (!plans?.length) {
      return ctx.reply('No plans available. Contact the seller.');
    }
    const keyboard = plans.map((p) => [Markup.button.callback(`${p.name} - ₹${p.price}`, `plan:${p.id}`)]);
    await ctx.reply('Choose a plan:', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^plan:(.+)$/, async (ctx) => {
    const planId = parseInt(ctx.match[1], 10);
    const plan = await getSupabase().from('plans').select('*').eq('id', planId).eq('seller_id', sellerId).single().then((r) => r.data);
    if (!plan) return ctx.answerCbQuery('Invalid plan');
    const seller = await getSellerById(sellerId);
    await ctx.reply(
      `Plan: ${plan.name} - ₹${plan.price}\n\nSend payment screenshot with UTR number as caption. Pay to seller and wait for approval.`
    );
    ctx.session = ctx.session || {};
    ctx.session.selectedPlanId = planId;
    await ctx.answerCbQuery();
  });

  bot.on('photo', async (ctx) => {
    const planId = ctx.session?.selectedPlanId;
    if (!planId) return ctx.reply('Please choose a plan first with /start');
    const caption = ctx.message.caption || '';
    const utr = (caption.match(/\b\d{12}\b/) || [])[0] || caption.trim() || 'N/A';
    const fileId = ctx.message.photo?.[ctx.message.photo.length - 1]?.file_id;
    const from = ctx.from;
    const telegramUserId = String(from.id);
    const username = from.username ? `@${from.username}` : from.first_name || 'User';

    const seller = await getSellerById(sellerId);
    if (!seller) return ctx.reply('Seller not configured.');

    const user = await findOrCreateUserByTelegram(telegramUserId, username);
    const userId = user.id;
    const blockedCheck = await isBlocked(userId, sellerId);
    if (blockedCheck) return ctx.reply('You are blocked.');

    const existing = await getSupabase()
      .from('payment_requests')
      .select('id, attempts, success_count')
      .eq('user_id', userId)
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
      .then((r) => r.data);
    const attempts = existing ? (existing.attempts || 0) + 1 : 1;
    const successCount = existing?.success_count ?? 0;

    const pr = await createPaymentRequest({
      user_id: userId,
      seller_id: sellerId,
      plan_id: planId,
      utr,
      screenshot_file_id: fileId,
      status: 'pending',
      attempts,
      success_count: successCount,
    });

    const acceptData = `pay_accept:${pr.id}`;
    const rejectData = `pay_reject:${pr.id}`;
    const blockData = `pay_block:${pr.id}`;
    const text = `Payment Request\nUser: ${username}\nPlan ID: ${planId}\nUTR: ${utr}\nAttempts: ${attempts}\nSuccess: ${successCount}\n\n[Accept] [Reject] [Block]`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Accept', acceptData), Markup.button.callback('Reject', rejectData), Markup.button.callback('Block', blockData)],
    ]);

    if (seller.telegram_username) {
      try {
        const target = seller.telegram_username.replace('@', '');
        await ctx.telegram.sendMessage(target, text, keyboard);
      } catch (e) {
        console.error('Notify seller failed:', e);
      }
    }
    await ctx.reply('Payment request sent. Wait for seller approval.');
    ctx.session.selectedPlanId = null;
  });

  bot.action(/^pay_accept:(.+)$/, async (ctx) => {
    const prId = parseInt(ctx.match[1], 10);
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return ctx.answerCbQuery('Invalid');
    const plan = await getSupabase().from('plans').select('*').eq('id', pr.plan_id).single().then((r) => r.data);
    const seller = await getSellerById(sellerId);
    if (!plan || !seller) return ctx.answerCbQuery('Error');

    const ccpu = seller.ccpu || 30;
    const creditsToDeduct = Math.ceil((plan.days / 30) * ccpu);
    if ((seller.credits_balance || 0) < creditsToDeduct) {
      await ctx.answerCbQuery('Insufficient credits');
      return ctx.reply('Insufficient seller credits.');
    }

    const key = generateKey();
    const expiresAt = addDays(new Date(), plan.days);
    await getSupabase().from('subscriptions').upsert(
      { user_id: pr.user_id, seller_id: sellerId, key, expires_at: expiresAt.toISOString(), max_devices: 1 },
      { onConflict: 'user_id,seller_id' }
    );
    await addLedgerEntry(sellerId, -creditsToDeduct, `Subscription for user ${pr.user_id}`, null);
    await getSupabase().from('sellers').update({ credits_balance: (seller.credits_balance || 0) - creditsToDeduct, updated_at: new Date().toISOString() }).eq('id', sellerId);
    await updatePaymentRequest(prId, { status: 'accepted' });

    const userRow = await getSupabase().from('users').select('*').eq('id', pr.user_id).single().then((r) => r.data);
    const telegramUserId = userRow?.telegram_user_id;
    if (telegramUserId && seller.telegram_bot_token) {
      const b = new Telegraf(seller.telegram_bot_token);
      await b.telegram.sendMessage(telegramUserId, `Approved! Your key: ${key}\nExpires: ${expiresAt.toLocaleDateString()}`);
    }
    await ctx.answerCbQuery('Accepted');
    await ctx.reply('Payment accepted. User notified.');
  });

  bot.action(/^pay_reject:(.+)$/, async (ctx) => {
    const prId = parseInt(ctx.match[1], 10);
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return ctx.answerCbQuery('Invalid');
    await updatePaymentRequest(prId, { status: 'rejected' });
    const user = await getSupabase().from('users').select('telegram_user_id').eq('id', pr.user_id).single().then((r) => r.data);
    if (user?.telegram_user_id) {
      const seller = await getSellerById(sellerId);
      if (seller?.telegram_bot_token) {
        const b = new Telegraf(seller.telegram_bot_token);
        await b.telegram.sendMessage(user.telegram_user_id, 'Payment rejected. Try again or contact seller.');
      }
    }
    await ctx.answerCbQuery('Rejected');
    await ctx.reply('Rejected.');
  });

  bot.action(/^pay_block:(.+)$/, async (ctx) => {
    const prId = parseInt(ctx.match[1], 10);
    const pr = await getPaymentRequestById(prId);
    if (!pr || pr.seller_id !== sellerId || pr.status !== 'pending') return ctx.answerCbQuery('Invalid');
    await blockUser(pr.user_id, sellerId);
    await updatePaymentRequest(prId, { status: 'blocked' });
    await ctx.answerCbQuery('Blocked');
    await ctx.reply('User blocked.');
  });
}
