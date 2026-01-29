-- Automated Key Distribution - PostgreSQL schema (Supabase)
-- Run this once in Supabase SQL Editor or via initDb().

-- Master Admin (system owner)
CREATE TABLE IF NOT EXISTS master_admin (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sellers (created by Master Admin)
CREATE TABLE IF NOT EXISTS sellers (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  telegram_username TEXT,
  telegram_bot_token TEXT,
  credits_balance INTEGER DEFAULT 0,
  ccpu INTEGER NOT NULL DEFAULT 30,
  query_channel_enabled INTEGER DEFAULT 0,
  query_group_link TEXT,
  query_group_chat_id TEXT,
  private_group_link TEXT,
  private_group_chat_id TEXT,
  maintenance_mode INTEGER DEFAULT 0,
  suspended INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit ledger (history of credit movements)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES master_admin(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans (seller-specific)
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  name TEXT NOT NULL,
  days INTEGER NOT NULL,
  price REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (end buyers, identified by Telegram)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_user_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  key TEXT UNIQUE NOT NULL,
  uuid TEXT DEFAULT '',
  max_devices INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  maintenance_paused_at TIMESTAMPTZ,
  expiry_reminder_sent INTEGER DEFAULT 0,
  expiry_kicked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_seller ON subscriptions(user_id, seller_id);

-- Payment requests (pending seller approval)
CREATE TABLE IF NOT EXISTS payment_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  utr TEXT,
  screenshot_file_id TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  unblocked_at TIMESTAMPTZ
);

-- Telegram bot session (for serverless webhook; key = fromId:chatId per seller)
CREATE TABLE IF NOT EXISTS telegram_sessions (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query forward map: when user message is forwarded to group, store mapping so reply can find user (serverless)
CREATE TABLE IF NOT EXISTS query_forward_map (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  group_chat_id TEXT NOT NULL,
  group_message_id INTEGER NOT NULL,
  telegram_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, group_chat_id, group_message_id)
);
