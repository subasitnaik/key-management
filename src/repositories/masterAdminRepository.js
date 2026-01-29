/**
 * Master admin repository.
 */

import { getSupabase } from '../db/supabase.js';

export async function findByUsername(username) {
  const { data, error } = await getSupabase()
    .from('master_admin')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findById(id) {
  const { data, error } = await getSupabase()
    .from('master_admin')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(username, passwordHash) {
  const { data, error } = await getSupabase()
    .from('master_admin')
    .insert({ username, password_hash: passwordHash })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function updatePassword(adminId, passwordHash) {
  const { error } = await getSupabase()
    .from('master_admin')
    .update({ password_hash: passwordHash })
    .eq('id', adminId);
  if (error) throw error;
}
