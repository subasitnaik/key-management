/**
 * Seller repository: get by id/slug, verify, create, update.
 */

import bcrypt from 'bcryptjs';
import { getSupabase } from '../db/supabase.js';

export async function getSellerById(id) {
  if (id == null || id === '') return null;
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('id', parseInt(id, 10))
    .maybeSingle();
  if (error) {
    console.error('getSellerById error:', error);
    return null;
  }
  return data;
}

export async function getSellerBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('slug', slug.trim())
    .maybeSingle();
  if (error) {
    console.error('getSellerBySlug error:', error);
    return null;
  }
  return data;
}

export async function verifySeller(username, password) {
  if (!username || !password) return null;
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .eq('username', username.trim())
    .maybeSingle();
  if (error || !data) return null;
  if (data.suspended) return null;
  const ok = bcrypt.compareSync(password, data.password_hash || '');
  return ok ? data : null;
}

export async function updateSeller(id, updates) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', parseInt(id, 10))
    .select()
    .maybeSingle();
  if (error) {
    console.error('updateSeller error:', error);
    return null;
  }
  return data;
}

export async function getAllSellers() {
  const { data, error } = await getSupabase()
    .from('sellers')
    .select('*')
    .order('id', { ascending: true });
  if (error) {
    console.error('getAllSellers error:', error);
    return [];
  }
  return data || [];
}

export async function createSeller({ slug, username, password_hash, telegram_username, telegram_bot_token, ccpu, query_channel_enabled, query_group_link, private_group_link }) {
  const { data, error } = await getSupabase()
    .from('sellers')
    .insert({
      slug: slug.trim(),
      username: username.trim(),
      password_hash,
      telegram_username: telegram_username?.trim() || null,
      telegram_bot_token: telegram_bot_token?.trim() || null,
      ccpu: ccpu != null ? parseInt(ccpu, 10) : 30,
      query_channel_enabled: query_channel_enabled ? 1 : 0,
      query_group_link: query_group_link?.trim() || null,
      private_group_link: private_group_link?.trim() || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
