import { getSupabase } from '../db/supabase.js';
import bcrypt from 'bcryptjs';

export async function findMasterAdminByUsername(username) {
  const { data } = await getSupabase().from('master_admin').select('*').eq('username', username).maybeSingle();
  return data;
}

export async function verifyMasterAdmin(username, password) {
  const admin = await findMasterAdminByUsername(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return null;
  return admin;
}
