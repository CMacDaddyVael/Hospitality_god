-- Content table for all AI-generated deliverables
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('listing_optimization', 'review_response', 'social_post', 'guest_message')),
  subtype TEXT, -- 'title' | 'description' | 'tags' for listing_optimization
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'regenerating')),
  original_text TEXT,
  ai_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  regeneration_count INTEGER NOT NULL DEFAULT 0,
  last_regenerated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS content_user_id_idx ON content(user_id);
CREATE INDEX IF NOT EXISTS content_property_id_idx ON content(property_id);
CREATE INDEX IF NOT EXISTS content_status_idx ON content(status);
CREATE INDEX IF NOT EXISTS content_type_subtype_idx ON content(type, subtype);

-- Composite index for "has approved version?" check
CREATE INDEX IF NOT EXISTS content_property_type_status_idx ON content(property_id, type, status);

-- Properties table to track listing URLs and user plans
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE,
  listing_url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'airbnb',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  listing_data JSONB DEFAULT '{}',
  optimization_queued_at TIMESTAMPTZ,
  optimization_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS properties_user_id_idx ON properties(user_id);

-- Regeneration rate-limit tracking
CREATE TABLE IF NOT EXISTS regeneration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  regenerated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS regen_log_content_date_idx ON regeneration_log(content_id, regenerated_at);

-- Auto-update updated_at on content changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
