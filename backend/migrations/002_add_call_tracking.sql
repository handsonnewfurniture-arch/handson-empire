-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add call tracking columns to handson_leads
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Add call tracking columns
ALTER TABLE handson_leads
ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_agent TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_time TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_outcome TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_notes TEXT DEFAULT NULL;

-- Add index for call status queries
CREATE INDEX IF NOT EXISTS idx_leads_call_status ON handson_leads(call_status);

-- Add comment explaining call_status values
COMMENT ON COLUMN handson_leads.call_status IS 'Call status: pending, called, completed, failed, no_answer, voicemail, booked';
COMMENT ON COLUMN handson_leads.call_agent IS 'Name of AI agent that made the call (e.g., Sarah, Emma, Jake)';
COMMENT ON COLUMN handson_leads.call_id IS 'Vapi call ID for tracking';
COMMENT ON COLUMN handson_leads.call_outcome IS 'Outcome: BOOKING_CONFIRMED, FOLLOW_UP_SCHEDULED, NOT_BOOKED, NO_ANSWER';
