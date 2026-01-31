-- Add Free Source–compatible panel fields to sellers
-- Run in Supabase SQL Editor if not yet applied.

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT '';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mod_name TEXT DEFAULT '';
