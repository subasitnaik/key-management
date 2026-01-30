-- Payment QR (Telegram file_id from seller upload) and seller chat_id for reliable messaging.
-- Run once in Supabase SQL Editor if you already have sellers table.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payment_qr_file_id TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS seller_telegram_chat_id TEXT;
