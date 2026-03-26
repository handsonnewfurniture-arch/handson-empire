-- ═══════════════════════════════════════════════════════════════════════════
-- UNIFIED COMMUNICATIONS TABLE
-- All texts, calls, emails in one place per customer
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS handson_comms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Link to customer/lead
  lead_id TEXT REFERENCES handson_leads(id),
  customer_id TEXT REFERENCES handson_customers(id),
  customer_phone TEXT,
  customer_name TEXT,

  -- Message details
  channel TEXT NOT NULL,  -- 'sms', 'call', 'email', 'voicemail'
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  content TEXT,           -- message body or call transcript
  summary TEXT,           -- AI-generated summary for calls

  -- Status
  status TEXT DEFAULT 'delivered', -- 'delivered', 'failed', 'pending', 'read'

  -- Channel-specific IDs for lookup
  external_id TEXT,       -- Twilio SID, Vapi call ID, etc.

  -- Call-specific fields
  call_duration INTEGER,  -- seconds
  call_outcome TEXT,      -- 'BOOKING_CONFIRMED', 'FOLLOW_UP', 'NO_ANSWER', etc.
  call_agent TEXT,        -- AI agent name (Sarah, Jake, etc.)
  recording_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_comms_customer_phone ON handson_comms(customer_phone);
CREATE INDEX IF NOT EXISTS idx_comms_lead_id ON handson_comms(lead_id);
CREATE INDEX IF NOT EXISTS idx_comms_created ON handson_comms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_channel ON handson_comms(channel);

-- Enable RLS
ALTER TABLE handson_comms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on comms" ON handson_comms FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE handson_comms;
