-- Email logs table to track sent emails and prevent duplicates
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('audit_complete', 'deliverables_ready', 'reengagement')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one email per type per user (prevents duplicate sends)
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_user_type_unique
  ON email_logs (user_id, email_type);

-- Index for cron job lookups
CREATE INDEX IF NOT EXISTS email_logs_email_type_idx ON email_logs (email_type);
CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON email_logs (user_id);

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled', 'past_due')),
  subscription_activated_at TIMESTAMPTZ,
  last_dashboard_visit TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit results table
CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_url TEXT NOT NULL,
  listing_score INTEGER NOT NULL CHECK (listing_score >= 0 AND listing_score <= 100),
  audit_status TEXT NOT NULL DEFAULT 'pending' CHECK (audit_status IN ('pending', 'processing', 'complete', 'failed')),
  recommendations JSONB DEFAULT '[]',
  raw_data JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_results_user_id_idx ON audit_results (user_id);
CREATE INDEX IF NOT EXISTS audit_results_status_idx ON audit_results (audit_status);

-- Deliverables table
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('listing_rewrite', 'review_response', 'social_post', 'guest_message', 'seasonal_update')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deliverables_user_id_idx ON deliverables (user_id);
CREATE INDEX IF NOT EXISTS deliverables_status_idx ON deliverables (status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_results_updated_at
  BEFORE UPDATE ON audit_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by server-side code)
-- Users can read their own data
CREATE POLICY "Users can read own email_logs" ON email_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read own audit_results" ON audit_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own deliverables" ON deliverables
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own deliverables" ON deliverables
  FOR UPDATE USING (auth.uid() = user_id);
