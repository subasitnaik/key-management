import 'dotenv/config';
import { initDb, getSupabase } from '../src/db/index.js';

const supabase = getSupabase();
await initDb();
const { error } = await supabase.from('subscriptions').update({ uuid: '' }).eq('key', 'testkey123');
if (error) {
  console.error('Reset failed:', error);
  process.exit(1);
}
console.log('Reset uuid for testkey123');
