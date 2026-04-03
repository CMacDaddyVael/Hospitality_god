-- Graduated Autonomy System
-- Implements crawl/walk/run trust framework for AI actions

-- ============================================================
-- Content Risk Tiers & Autonomy Levels
-- ============================================================
-- risk_tier: 'low' | 'medium' | 'high'
-- autonomy_level: 'suggest' | 'smart_auto' | 'full_auto'

-- ============================================================
-- autonomy_settings: per-user, per-content-type autonomy level
-- ============================================================
CREATE TABLE IF NOT EXISTS autonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  -- 'suggest' = all require approval
  -- 'smart_auto' = low-risk auto, medium/high need approval
  -- 'full_auto' = all auto unless flagged
  autonomy_level TEXT NOT NULL DEFAULT 'suggest'
    CHECK (autonomy_level IN ('suggest', 'smart_auto', 'full_auto')),
  risk_tier TEXT NOT NULL
    CHECK (risk_tier IN ('low', 'medium', 'high')),
  -- emergency pause overrides everything
  is_paused BOOLEAN NOT NULL DEFAULT false,
  -- when the user explicitly enabled this autonomy level
  enabled_at TIMESTAMPTZ,
  -- who enabled it: 'user' | 'system_prompt' (system suggested and user accepted)
  enabled_by TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type)
);

-- Seed default content types for every new user
-- Called via trigger or application code on user creation

-- ============================================================
-- ai_actions: every AI action logged with full audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- content type matches autonomy_settings.content_type
  content_type TEXT NOT NULL,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  -- 'pending' | 'approved' | 'edited' | 'rejected' | 'auto_executed' | 'expired' | 'reverted'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'edited', 'rejected', 'auto_executed', 'expired', 'reverted')),
  -- the AI-generated draft content
  draft_content JSONB NOT NULL,
  -- if the owner edited before approving, store their version
  edited_content JSONB,
  -- final content that was actually used/published
  final_content JSONB,
  -- human-readable title for the action (shown in UI)
  title TEXT NOT NULL,
  -- short description
  description TEXT,
  -- context: listing_id, review_id, etc.
  context_data JSONB DEFAULT '{}',
  -- notification sent at
  notification_sent_at TIMESTAMPTZ,
  -- when owner responded
  reviewed_at TIMESTAMPTZ,
  -- who reviewed: 'owner' | 'system_auto'
  reviewed_by TEXT,
  -- auto-executed at (for smart_auto / full_auto actions)
  executed_at TIMESTAMPTZ,
  -- 24-hour revert window: revert_available_until
  revert_available_until TIMESTAMPTZ,
  -- if reverted, when
  reverted_at TIMESTAMPTZ,
  -- expires after 48 hours if not responded to
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  -- was this used as voice training data?
  used_for_training BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast pending action queries
CREATE INDEX IF NOT EXISTS idx_ai_actions_user_status
  ON ai_actions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_actions_user_type
  ON ai_actions(user_id, content_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_actions_expires
  ON ai_actions(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_actions_revert_window
  ON ai_actions(revert_available_until)
  WHERE status = 'auto_executed';

-- ============================================================
-- confidence_scores: rolling approval rate per content type
-- ============================================================
CREATE TABLE IF NOT EXISTS confidence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  -- rolling window stats
  total_actions INTEGER NOT NULL DEFAULT 0,
  approved_unchanged INTEGER NOT NULL DEFAULT 0, -- approved with no edits
  approved_edited INTEGER NOT NULL DEFAULT 0,    -- approved but edited
  rejected INTEGER NOT NULL DEFAULT 0,
  -- computed approval rate (approved_unchanged / (approved_unchanged + approved_edited + rejected))
  approval_rate NUMERIC(5,4) DEFAULT 0,
  -- last 20 actions window for upgrade prompts
  last_20_approved_unchanged INTEGER DEFAULT 0,
  last_20_total INTEGER DEFAULT 0,
  -- whether system has already prompted upgrade for this content type
  upgrade_prompted_at TIMESTAMPTZ,
  -- whether user dismissed the upgrade prompt
  upgrade_dismissed_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type)
);

-- ============================================================
-- autonomy_upgrade_prompts: tracks when/what we suggested
-- ============================================================
CREATE TABLE IF NOT EXISTS autonomy_upgrade_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  suggested_level TEXT NOT NULL CHECK (suggested_level IN ('smart_auto', 'full_auto')),
  -- 'pending' | 'accepted' | 'dismissed'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  -- snapshot of approval rate that triggered this
  approval_rate_snapshot NUMERIC(5,4),
  actions_count_snapshot INTEGER,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- weekly_digests: tracks sent digests
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  -- summary stats
  total_actions INTEGER DEFAULT 0,
  auto_executed INTEGER DEFAULT 0,
  pending_actions INTEGER DEFAULT 0,
  -- email sent status
  email_sent_at TIMESTAMPTZ,
  email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_upgrade_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

-- autonomy_settings policies
CREATE POLICY "Users can view own autonomy settings"
  ON autonomy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own autonomy settings"
  ON autonomy_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage autonomy settings"
  ON autonomy_settings FOR ALL
  USING (auth.role() = 'service_role');

-- ai_actions policies
CREATE POLICY "Users can view own ai actions"
  ON ai_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own ai actions"
  ON ai_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ai actions"
  ON ai_actions FOR ALL
  USING (auth.role() = 'service_role');

-- confidence_scores policies
CREATE POLICY "Users can view own confidence scores"
  ON confidence_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage confidence scores"
  ON confidence_scores FOR ALL
  USING (auth.role() = 'service_role');

-- upgrade prompts policies
CREATE POLICY "Users can view own upgrade prompts"
  ON autonomy_upgrade_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own upgrade prompts"
  ON autonomy_upgrade_prompts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage upgrade prompts"
  ON autonomy_upgrade_prompts FOR ALL
  USING (auth.role() = 'service_role');

-- weekly_digests policies
CREATE POLICY "Users can view own digests"
  ON weekly_digests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage digests"
  ON weekly_digests FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Functions & Triggers
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_autonomy_settings_updated_at
  BEFORE UPDATE ON autonomy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_actions_updated_at
  BEFORE UPDATE ON ai_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_confidence_scores_updated_at
  BEFORE UPDATE ON confidence_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to recalculate confidence score after an action is reviewed
CREATE OR REPLACE FUNCTION recalculate_confidence_score(
  p_user_id UUID,
  p_content_type TEXT
)
RETURNS void AS $$
DECLARE
  v_total INTEGER;
  v_approved_unchanged INTEGER;
  v_approved_edited INTEGER;
  v_rejected INTEGER;
  v_approval_rate NUMERIC(5,4);
  v_last_20_total INTEGER;
  v_last_20_approved_unchanged INTEGER;
BEGIN
  -- Full history counts
  SELECT
    COUNT(*) FILTER (WHERE status IN ('approved', 'edited', 'rejected', 'auto_executed')),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'edited'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total, v_approved_unchanged, v_approved_edited, v_rejected
  FROM ai_actions
  WHERE user_id = p_user_id
    AND content_type = p_content_type
    AND status IN ('approved', 'edited', 'rejected', 'auto_executed');

  -- Approval rate
  IF (v_approved_unchanged + v_approved_edited + v_rejected) > 0 THEN
    v_approval_rate := v_approved_unchanged::NUMERIC /
      (v_approved_unchanged + v_approved_edited + v_rejected)::NUMERIC;
  ELSE
    v_approval_rate := 0;
  END IF;

  -- Last 20 actions window
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_last_20_total, v_last_20_approved_unchanged
  FROM (
    SELECT status
    FROM ai_actions
    WHERE user_id = p_user_id
      AND content_type = p_content_type
      AND status IN ('approved', 'edited', 'rejected', 'auto_executed')
    ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
    LIMIT 20
  ) recent;

  -- Upsert confidence score
  INSERT INTO confidence_scores (
    user_id, content_type,
    total_actions, approved_unchanged, approved_edited, rejected,
    approval_rate, last_20_total, last_20_approved_unchanged,
    last_calculated_at
  )
  VALUES (
    p_user_id, p_content_type,
    v_total, v_approved_unchanged, v_approved_edited, v_rejected,
    v_approval_rate, v_last_20_total, v_last_20_approved_unchanged,
    now()
  )
  ON CONFLICT (user_id, content_type)
  DO UPDATE SET
    total_actions = v_total,
    approved_unchanged = v_approved_unchanged,
    approved_edited = v_approved_edited,
    rejected = v_rejected,
    approval_rate = v_approval_rate,
    last_20_total = v_last_20_total,
    last_20_approved_unchanged = v_last_20_approved_unchanged,
    last_calculated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate confidence when an action status changes
CREATE OR REPLACE FUNCTION trigger_recalculate_confidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'edited', 'rejected', 'auto_executed') THEN
    PERFORM recalculate_confidence_score(NEW.user_id, NEW.content_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_confidence_on_action_update
  AFTER UPDATE ON ai_actions
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_confidence();

-- ============================================================
-- Default content type seed data (insert on user creation)
-- ============================================================
-- This is called from application code; see lib/autonomy/seed-defaults.ts
-- Content types:
--   low risk:    'checkin_message', 'social_post', 'seasonal_pricing_nudge'
--   medium risk: 'positive_review_response', 'listing_tweak'
--   high risk:   'negative_review_response', 'listing_rewrite', 'photo_swap', 'pricing_change'
