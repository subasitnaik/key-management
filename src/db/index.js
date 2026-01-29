/**
 * Database init and default data.
 * Uses Supabase client (project URL + anon key). Run schema.pg.sql in Supabase SQL Editor once.
 * Creates default admin + test seller on first start.
 */

import bcrypt from 'bcryptjs';
import { getSupabase } from './supabase.js';

export { getSupabase } from './supabase.js';

async function ensureDefaultData() {
  const supabase = getSupabase();

  const { data: adminExists } = await supabase.from('master_admin').select('id').eq('username', 'admin').maybeSingle();
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await supabase.from('master_admin').insert({ username: 'admin', password_hash: hash });
    console.log('Created master admin: admin / admin123');
  }

  const { data: sellerExists } = await supabase.from('sellers').select('id').eq('slug', 'test').maybeSingle();
  if (!sellerExists) {
    const hash = bcrypt.hashSync('seller123', 10);
    const { data: seller } = await supabase
      .from('sellers')
      .insert({ slug: 'test', username: 'testseller', password_hash: hash, credits_balance: 100, ccpu: 30 })
      .select('id')
      .single();
    if (seller) {
      await supabase.from('plans').insert([
        { seller_id: seller.id, name: '7 Days', days: 7, price: 50 },
        { seller_id: seller.id, name: '15 Days', days: 15, price: 100 },
        { seller_id: seller.id, name: '30 Days', days: 30, price: 200 },
      ]);
      console.log('Created test seller: testseller / seller123, slug: test, 100 credits');
    }
  }

  const { data: seller } = await supabase.from('sellers').select('id').eq('slug', 'test').single();
  if (seller) {
    await supabase.from('users').upsert(
      { telegram_user_id: '123456789', telegram_username: 'testuser' },
      { onConflict: 'telegram_user_id' }
    );
    const { data: user } = await supabase.from('users').select('id').eq('telegram_user_id', '123456789').single();
    if (user) {
      const { data: subExists } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('key', 'testkey123')
        .eq('seller_id', seller.id)
        .maybeSingle();
      if (!subExists) {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          seller_id: seller.id,
          key: 'testkey123',
          expires_at: '2026-12-31 23:59:59',
          max_devices: 1,
        });
        console.log('Test key for /connect: testkey123 (expires 2026-12-31)');
      }
    }
  }
}

/** Ensure default admin/seller exist. Schema is run by you in Supabase SQL Editor. */
export async function initDb() {
  await ensureDefaultData();
}
