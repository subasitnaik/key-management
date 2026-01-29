/**
 * Payment request repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function create(pr) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .insert({
      user_id: pr.userId,
      seller_id: pr.sellerId,
      plan_id: pr.planId,
      utr: pr.utr || null,
      screenshot_file_id: pr.screenshotFileId || null,
      attempts: pr.attempts ?? 0,
      success_count: pr.successCount ?? 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function findPendingByUserAndSeller(userId, sellerId) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('seller_id', sellerId)
    .eq('status', 'pending')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function incrementAttempts(id) {
  const { data: row } = await getSupabase().from('payment_requests').select('attempts').eq('id', id).single();
  if (!row) return;
  const { error } = await getSupabase()
    .from('payment_requests')
    .update({ attempts: (row.attempts || 0) + 1 })
    .eq('id', id);
  if (error) throw error;
}

export async function updateStatus(id, status) {
  const { error } = await getSupabase().from('payment_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function incrementSuccess(id) {
  const { data: row } = await getSupabase().from('payment_requests').select('success_count').eq('id', id).single();
  if (!row) return;
  const { error } = await getSupabase()
    .from('payment_requests')
    .update({ success_count: (row.success_count || 0) + 1 })
    .eq('id', id);
  if (error) throw error;
}

export async function findById(id) {
  const { data, error } = await getSupabase().from('payment_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPendingBySeller(sellerId) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .select('*, users!user_id(telegram_user_id, telegram_username), plans!plan_id(name, days)')
    .eq('seller_id', sellerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data || []).map((pr) => ({
    ...pr,
    plan_name: pr.plans?.name,
    days: pr.plans?.days,
  }));
  return rows;
}
