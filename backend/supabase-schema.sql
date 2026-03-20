-- ══════════════════════════════════════════════════════════════════════════════
-- HANDSON EMPIRE - SUPABASE DATABASE SCHEMA
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this in your Supabase SQL Editor to create all tables
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══ LEADS TABLE ═══
CREATE TABLE IF NOT EXISTS handson_leads (
  id TEXT PRIMARY KEY,
  trade TEXT NOT NULL,
  source TEXT NOT NULL,
  signal_type TEXT,
  title TEXT NOT NULL,
  city TEXT,
  state TEXT DEFAULT 'CO',
  signal_date DATE,
  status TEXT DEFAULT 'NEW',
  score INTEGER DEFAULT 50,
  priority TEXT DEFAULT 'WARM',
  urgency TEXT,
  revenue INTEGER,
  signals JSONB DEFAULT '[]',
  phone TEXT,
  address TEXT,
  notes TEXT,
  link TEXT,
  sms TEXT,
  claimed_by TEXT,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_leads_trade ON handson_leads(trade);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON handson_leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_status ON handson_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON handson_leads(created_at DESC);

-- Enable RLS
ALTER TABLE handson_leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (tighten in production)
CREATE POLICY "Allow all operations on leads" ON handson_leads
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ WORKERS TABLE ═══
CREATE TABLE IF NOT EXISTS handson_workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trades TEXT[] NOT NULL,
  tier TEXT DEFAULT 'Pro',
  rating DECIMAL(2,1) DEFAULT 4.5,
  jobs INTEGER DEFAULT 0,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'available',
  bio TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on workers" ON handson_workers
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ CUSTOMERS TABLE ═══
CREATE TABLE IF NOT EXISTS handson_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'CO',
  total_jobs INTEGER DEFAULT 0,
  total_spend INTEGER DEFAULT 0,
  status TEXT DEFAULT 'New',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customers" ON handson_customers
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ JOBS TABLE ═══
CREATE TABLE IF NOT EXISTS handson_jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES handson_customers(id),
  worker_id TEXT REFERENCES handson_workers(id),
  lead_id TEXT REFERENCES handson_leads(id),
  trade TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  deposit INTEGER DEFAULT 0,
  total_price INTEGER,
  scheduled_date DATE,
  completed_date DATE,
  rating INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on jobs" ON handson_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ SCRAPERS TABLE (for monitoring) ═══
CREATE TABLE IF NOT EXISTS handson_scrapers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  last_run TIMESTAMP,
  leads_found INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_scrapers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on scrapers" ON handson_scrapers
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ AFFILIATE REFERRALS TABLE ═══
CREATE TABLE IF NOT EXISTS handson_referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT,
  referrer_type TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  trade TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'PENDING',
  payout INTEGER DEFAULT 25,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on referrals" ON handson_referrals
  FOR ALL USING (true) WITH CHECK (true);

-- ═══ CREW ACTIVITY TABLE ═══
CREATE TABLE IF NOT EXISTS handson_crew_activity (
  id SERIAL PRIMARY KEY,
  direction TEXT NOT NULL, -- 'SENT' or 'RECV'
  from_worker_id TEXT REFERENCES handson_workers(id),
  to_worker_id TEXT REFERENCES handson_workers(id),
  customer_name TEXT,
  trade TEXT,
  notes TEXT,
  result TEXT,
  value INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE handson_crew_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on crew_activity" ON handson_crew_activity
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert sample workers
INSERT INTO handson_workers (id, name, trades, tier, rating, jobs, phone, status, bio) VALUES
('w1', 'Marcus T.', ARRAY['movers'], 'Elite', 4.9, 847, '(720) 441-9923', 'available', 'Denver''s #1 rated mover. 847 five-star moves.'),
('w2', 'Sarah K.', ARRAY['roofing'], 'Pro', 4.8, 312, '(303) 882-4411', 'available', '15yr roofing pro. Storm damage specialist.'),
('w3', 'Diego R.', ARRAY['electrical', 'plumbing'], 'Elite', 4.9, 1204, '(720) 554-7823', 'on_job', 'Licensed electrician & master plumber.'),
('w4', 'James W.', ARRAY['solar'], 'Elite', 5.0, 89, '(303) 991-8823', 'available', 'Top-rated solar installer in CO.'),
('w5', 'Carlos F.', ARRAY['movers', 'dumpster', 'trailer'], 'Elite', 4.8, 2341, '(303) 882-1234', 'available', 'Full-service moving, dumpster rental & trailer haul.')
ON CONFLICT (id) DO NOTHING;

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE handson_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE handson_workers;
ALTER PUBLICATION supabase_realtime ADD TABLE handson_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE handson_customers;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE!
-- ═══════════════════════════════════════════════════════════════════════════
