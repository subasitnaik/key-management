/**
 * Telegram bot for user flow.
 * One bot per seller. Each seller has their own bot token.
 * When sessionStore is provided (webhook/serverless), session is persisted in Supabase.
 */

import { Telegraf, session } from 'telegraf';
import { getSupabase } from '../db/supabase.js';
import * as userRepository from '../repositories/userRepository.js';
import * as sellerRepository from '../repositories/sellerRepository.js';
import * as planRepository from '../repositories/planRepository.js';
import * as paymentRequestRepository from '../repositories/paymentRequestRepository.js';
import * as blockedUserRepository from '../repositories/blockedUserRepository.js';
import * as subscriptionRepository from '../repositories/subscriptionRepository.js';

function parseQueryGroupChatId(link) {
  if (!link || !link.trim()) return null;
  const s = link.trim();
  if (s.startsWith('@')) return s;
  const num = parseInt(s, 10);
  if (!isNaN(num) && num < 0) return num;
  const m = s.match(/t\.me\/([a-zA-Z0-9_]+)/);
  return m ? `@${m[1]}` : null;
}

/**
 * Create a bot instance for a specific seller.
 * @param {string} token - Telegram bot token
 * @param {number} sellerId - Seller ID (this bot belongs to this seller)
 * @param {{ get: (k: string) => Promise<any>, set: (k: string, v: any) => Promise<void>, delete: (k: string) => Promise<void> }} [sessionStore] - Optional store for session (required for webhook/serverless)
 */
export function createBotForSeller(token, sellerId, sessionStore = null) {
  if (!token || !token.trim()) return null;

  const bot = new Telegraf(token.trim());
  const getSessionKey = (ctx) => {
    const fromId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (fromId == null || chatId == null) return undefined;
    return `${sellerId}:${fromId}:${chatId}`;
  };
  bot.use(
    session({
      store: sessionStore || undefined,
      getSessionKey,
    })
  );
  const supabase = getSupabase();

  bot.start(async (ctx) => {
    const seller = await sellerRepository.findById(sellerId);
    if (!seller || seller.suspended) {
      return ctx.reply('Bot is not configured. Please contact your seller.');
    }
    const user = await userRepository.findOrCreate(
      String(ctx.from.id),
      ctx.from.username ? `@${ctx.from.username}` : null
    );
    ctx.session = ctx.session || {};
    ctx.session.sellerId = sellerId;
    ctx.session.userId = user.id;
    return showPlans(ctx);
  });

  async function showPlans(ctx) {
    const sellerId = ctx.session?.sellerId;
    if (!sellerId) return ctx.reply('Please /start again.');
    const seller = await sellerRepository.findById(sellerId);
    const plans = await planRepository.findBySeller(sellerId);
    if (!plans.length) {
      return ctx.reply('No plans available. Contact your seller.');
    }
    const keyboard = plans.map((p) => [{ text: `${p.name} - ₹${p.price}`, callback_data: `plan_${p.id}` }]);
    return ctx.reply('Select a plan:', {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  bot.action(/^plan_(.+)$/, async (ctx) => {
    const planId = parseInt(ctx.match[1], 10);
    const sellerId = ctx.session?.sellerId;
    const userId = ctx.session?.userId;
    if (!sellerId || !userId) return ctx.answerCbQuery('Session expired. /start again.');
    if (await blockedUserRepository.isBlocked(userId, sellerId)) {
      return ctx.answerCbQuery('You are blocked. Contact your seller.');
    }
    const plan = await planRepository.findById(planId);
    if (!plan || plan.seller_id !== sellerId) return ctx.answerCbQuery('Invalid plan.');
    const seller = await sellerRepository.findById(sellerId);
    ctx.session.planId = planId;
    ctx.session.waitingPayment = true;
    await ctx.answerCbQuery();
    return ctx.reply(
      `Plan: ${plan.name} - ₹${plan.price}\n\n` +
        `Send payment of ₹${plan.price} and reply with:\n` +
        `1. Payment screenshot\n` +
        `2. UTR number as caption\n\n` +
        `Payment details will be sent by @${(seller.telegram_username || '').replace('@', '')}`
    );
  });

  bot.on('text', async (ctx) => {
    if (ctx.session?.waitingPayment) return;
    const sellerId = ctx.session?.sellerId;
    const userId = ctx.session?.userId;
    if (!sellerId || !userId) return;
    const seller = await sellerRepository.findById(sellerId);
    if (!seller?.query_channel_enabled || !seller?.query_group_link) return;
    if (await blockedUserRepository.isBlocked(userId, sellerId)) return;
    if (!(await subscriptionRepository.hasActiveSubscription(userId, sellerId))) {
      return ctx.reply('Query channel is for paid users only.');
    }
    const chatId = parseQueryGroupChatId(seller.query_group_link);
    if (!chatId) return ctx.reply('Query group not configured. Contact seller.');
    try {
      const fwd = await ctx.telegram.forwardMessage(
        chatId,
        ctx.chat.id,
        ctx.message.message_id
      );
      await supabase.from('query_forward_map').insert({
        seller_id: sellerId,
        group_chat_id: String(fwd.chat.id),
        group_message_id: fwd.message_id,
        telegram_user_id: String(ctx.from.id),
      });
      ctx.reply('Your query has been forwarded to the support team. You will receive a reply here.');
    } catch (e) {
      console.warn('Query forward failed:', e.message);
      ctx.reply('Could not forward. Make sure the bot is in the query group.');
    }
  });

  bot.on('message', async (ctx) => {
    const chat = ctx.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') return;
    const replyTo = ctx.message?.reply_to_message;
    if (!replyTo) return;
    const { data: row } = await supabase
      .from('query_forward_map')
      .select('telegram_user_id')
      .eq('seller_id', sellerId)
      .eq('group_chat_id', String(chat.id))
      .eq('group_message_id', replyTo.message_id)
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const text = ctx.message.text || ctx.message.caption || '[Media]';
    try {
      await ctx.telegram.sendMessage(row.telegram_user_id, `Support reply:\n\n${text}`);
      await supabase
        .from('query_forward_map')
        .delete()
        .eq('seller_id', sellerId)
        .eq('group_chat_id', String(chat.id))
        .eq('group_message_id', replyTo.message_id);
    } catch (e) {
      console.warn('Query reply forward failed:', e.message);
    }
  });

  bot.on('chat_join_request', async (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.chatJoinRequest?.from?.id;
    if (!chatId || !userId) return;
    const seller = await sellerRepository.findByPrivateGroupChatId(chatId);
    if (!seller || seller.id !== sellerId) return;
    const user = await userRepository.findByTelegramId(String(userId));
    if (!user) {
      try {
        await ctx.declineChatJoinRequest(userId);
      } catch (_) {}
      return;
    }
    const hasActive = await subscriptionRepository.hasActiveSubscription(user.id, seller.id);
    try {
      if (hasActive) {
        await ctx.approveChatJoinRequest(userId);
      } else {
        await ctx.declineChatJoinRequest(userId);
      }
    } catch (e) {
      console.warn('Chat join request handling failed:', e.message);
    }
  });

  bot.on('photo', async (ctx) => {
    if (!ctx.session?.waitingPayment) return;
    const caption = ctx.message.caption || '';
    const utr = caption.trim();
    const sellerId = ctx.session.sellerId;
    const userId = ctx.session.userId;
    const planId = ctx.session.planId;
    if (!sellerId || !userId || !planId) return ctx.reply('Session expired. /start again.');
    let pr = await paymentRequestRepository.findPendingByUserAndSeller(userId, sellerId);
    if (pr) {
      await paymentRequestRepository.incrementAttempts(pr.id);
    } else {
      await paymentRequestRepository.create({
        userId,
        sellerId,
        planId,
        utr,
        screenshotFileId: ctx.message.photo[ctx.message.photo.length - 1]?.file_id,
        attempts: 1,
        successCount: 0,
      });
    }
    ctx.session.waitingPayment = false;
    ctx.session.planId = null;
    return ctx.reply('Payment received. Seller will approve shortly. You will receive your key here.');
  });

  return { bot, sellerId };
}
