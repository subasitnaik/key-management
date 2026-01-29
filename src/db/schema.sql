-- Automated Key Distribution - Database Schema
-- SQLite compatible

-- Master Admin (system owner)
CREATE TABLE IF NOT EXISTS master_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sellers (created by Master Admin)
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  telegram_username TEXT,
  telegram_bot_token TEXT,
  credits_balance INTEGER DEFAULT 0,
  ccpu INTEGER NOT NULL DEFAULT 30,
  query_channel_enabled INTEGER DEFAULT 0,
  query_group_link TEXT,
  private_group_link TEXT,
  maintenance_mode INTEGER DEFAULT 0,
  suspended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Credit ledger (history of credit movements)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (created_by) REFERENCES master_admin(id)
);

-- Plans (seller-specific: 7 days, 15 days, 30 days, etc.)
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  days INTEGER NOT NULL,
  price REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- Users (end buyers, identified by Telegram)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Subscriptions (one key per user per seller, or common key with max_devices)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  key TEXT UNIQUE NOT NULL,
  uuid TEXT DEFAULT '',
  max_devices INTEGER DEFAULT 1,
  expires_at TEXT NOT NULL,
  maintenance_paused_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_seller ON subscriptions(user_id, seller_id);

-- Payment requests (pending seller approval)
CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  utr TEXT,
  screenshot_file_id TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- Blocked users (user blocked for a seller)
CREATE TABLE IF NOT EXISTS blocked_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  blocked_at TEXT DEFAULT (datetime('now')),
  unblocked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);
