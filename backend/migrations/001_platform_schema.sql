-- ══════════════════════════════════════════════════════════════════════════════
-- HANDSON EMPIRE - FULL PLATFORM SCHEMA MIGRATION
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- SMS Authentication Sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'worker')),
  user_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_phone ON auth_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Portfolio Items (Instagram-style gallery)
CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'worker')),
  user_id TEXT NOT NULL,
  job_id TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  trade TEXT,
  city TEXT,
  likes INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_items(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_trade ON portfolio_items(trade);
CREATE INDEX IF NOT EXISTS idx_portfolio_featured ON portfolio_items(is_featured);

-- Two-Way Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('customer', 'worker')),
  reviewer_id TEXT NOT NULL,
  reviewee_type TEXT NOT NULL CHECK (reviewee_type IN ('customer', 'worker')),
  reviewee_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_type, reviewee_id);

-- Stripe Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  worker_payout INTEGER NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  proof_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payments_job ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_worker ON payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ══════════════════════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- Add Stripe fields to workers
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS stripe_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS total_earnings INTEGER DEFAULT 0;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(2,1) DEFAULT 5.0;
ALTER TABLE handson_workers ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add Stripe fields to customers
ALTER TABLE handson_customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE handson_customers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE handson_customers ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(2,1) DEFAULT 5.0;
ALTER TABLE handson_customers ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE handson_customers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Enhance jobs table
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS scope_of_work TEXT;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS scope_images TEXT[];
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS proof_of_work_images TEXT[];
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS customer_rating INTEGER;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS worker_rating INTEGER;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'flexible';
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE handson_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- ══════════════════════════════════════════════════════════════════════════════
-- ENABLE ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (tighten in production)
CREATE POLICY "Allow all auth_sessions" ON auth_sessions FOR ALL USING (true);
CREATE POLICY "Allow all portfolio_items" ON portfolio_items FOR ALL USING (true);
CREATE POLICY "Allow all reviews" ON reviews FOR ALL USING (true);
CREATE POLICY "Allow all payments" ON payments FOR ALL USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- ENABLE REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE auth_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_items;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ══════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (run these in Supabase Dashboard > Storage)
-- ══════════════════════════════════════════════════════════════════════════════

-- Create buckets for:
-- 1. profile-images (public)
-- 2. job-images (public)
-- 3. portfolio-images (public)
-- 4. proof-of-payment (private)

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ══════════════════════════════════════════════════════════════════════════════
