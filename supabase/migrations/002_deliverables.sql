-- Deliverables table for approvable AI-generated content items
-- Stores all AI-created content pending owner approval

CREATE TABLE IF NOT EXISTS deliverables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'review_response',
    'social_post',
    'listing_optimization',
    'guest_message',
    'seasonal_update',
    'competitor_analysis'
  )),
  status        TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'pending_approval',
    'approved',
    'rejected',
    'published'
  )),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast property + type lookups (dashboard inbox)
CREATE INDEX IF NOT EXISTS idx_deliverables_property_id ON deliverables(property_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_type ON deliverables(type);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_property_status ON deliverables(property_id, status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deliverables_updated_at
  BEFORE UPDATE ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_deliverables_updated_at();

-- RLS: owners can only see their own property deliverables
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their deliverables"
  ON deliverables FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their deliverables"
  ON deliverables FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM properties WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for server-side generation
CREATE POLICY "Service role full access"
  ON deliverables FOR ALL
  USING (auth.role() = 'service_role');
