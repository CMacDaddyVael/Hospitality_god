-- Seasonal content deliverables table
-- Stores AI-generated seasonal listing copy, social captions, and image briefs
-- One record per property per month

CREATE TABLE IF NOT EXISTS seasonal_content_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Property/user association
  property_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  
  -- Seasonal context
  season TEXT NOT NULL CHECK (season IN ('Winter', 'Spring', 'Summer', 'Fall')),
  holiday TEXT,
  seasonal_theme TEXT NOT NULL,
  target_month TEXT NOT NULL,          -- e.g. "December 2025"
  target_date TIMESTAMPTZ NOT NULL,    -- First day of target month
  property_context TEXT,               -- beach, mountain, desert, pool, cabin, default
  
  -- Generated content (full JSON payload from Claude)
  content JSONB NOT NULL,
  /*
    content structure:
    {
      listingDescription: {
        headline: string,
        description: string
      },
      socialCaptions: [
        {
          platform: "instagram" | "instagram_story" | "facebook",
          caption: string,
          hashtags: string[]
        }
      ],
      imageGenerationBriefs: [
        {
          id: string,
          title: string,
          sceneDescription: string,
          seasonalElements: string[],
          mood: string,
          suggestedCast: string,
          usageContext: string
        }
      ],
      seasonalSummary: {
        season: string,
        holiday: string,
        theme: string,
        targetMonth: string,
        keySellingAngles: string[]
      }
    }
  */
  
  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  
  -- Timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast property lookups
CREATE INDEX IF NOT EXISTS idx_seasonal_content_property_id 
  ON seasonal_content_deliverables(property_id);

-- Index for user dashboard queries
CREATE INDEX IF NOT EXISTS idx_seasonal_content_user_id 
  ON seasonal_content_deliverables(user_id);

-- Index for pending review items (used by dashboard)
CREATE INDEX IF NOT EXISTS idx_seasonal_content_status 
  ON seasonal_content_deliverables(status) 
  WHERE status = 'pending_review';

-- Index for monthly dedup check
CREATE INDEX IF NOT EXISTS idx_seasonal_content_property_month 
  ON seasonal_content_deliverables(property_id, target_month);

-- Add last_seasonal_update column to properties table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' 
    AND column_name = 'last_seasonal_update'
  ) THEN
    ALTER TABLE properties ADD COLUMN last_seasonal_update TIMESTAMPTZ;
  END IF;
END $$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_seasonal_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seasonal_content_updated_at
  BEFORE UPDATE ON seasonal_content_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_seasonal_content_updated_at();

-- RLS policies
ALTER TABLE seasonal_content_deliverables ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deliverables
CREATE POLICY "Users can view own seasonal content"
  ON seasonal_content_deliverables FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update status of their own deliverables
CREATE POLICY "Users can update own seasonal content status"
  ON seasonal_content_deliverables FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for workers)
CREATE POLICY "Service role full access"
  ON seasonal_content_deliverables FOR ALL
  USING (auth.role() = 'service_role');
