-- Cycle-based earning: reset cycle updates cycle_started_at; earning = sum of accepted payments since then.
-- Run once in Supabase SQL Editor.
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMPTZ;
-- For existing sellers, treat NULL as "all time" until first reset (then set to NOW()).
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
