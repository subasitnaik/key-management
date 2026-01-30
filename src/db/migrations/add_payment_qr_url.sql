-- Add payment QR image URL for sellers (run once in Supabase SQL Editor if you already have sellers table)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payment_qr_url TEXT;
