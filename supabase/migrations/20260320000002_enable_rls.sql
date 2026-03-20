-- ============================================================
-- VAEL Host — Row Level Security Policies
-- Migration: 20260320000002_enable_rls
-- ============================================================
-- All tables use the pattern: owners can only access their own
-- rows, identified by matching owner_id = auth.uid() or
-- id = auth.uid() (for the owners table itself).
-- ============================================================

-- ============================================================
-- owners table RLS
-- ============================================================

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- Owners can read their own profile
CREATE POLICY "owners_select_own"
  ON owners
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Owners can update their own profile
CREATE POLICY "owners_update_own"
  ON owners
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert is handled by the trigger/function that mirrors auth.users
-- Service role bypasses RLS for system inserts
CREATE POLICY "owners_insert_own"
  ON owners
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- properties table RLS
-- ============================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties_select_own"
  ON properties
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "properties_insert_own"
  ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "properties_update_own"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "properties_delete_own"
  ON properties
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- audits table RLS
-- ============================================================

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_select_own"
  ON audits
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "audits_insert_own"
  ON audits
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "audits_update_own"
  ON audits
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owners cannot delete audit records (immutable history)
-- Only service role (backend) may delete audits

-- ============================================================
-- audit_scores table RLS
-- Scores are accessed via their parent audit — join required
-- ============================================================

ALTER TABLE audit_scores ENABLE ROW LEVEL SECURITY;

-- Owner can read scores if they own the parent audit
CREATE POLICY "audit_scores_select_own"
  ON audit_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = audit_scores.audit_id
        AND a.owner_id = auth.uid()
    )
  );

-- Insert/update allowed only via service role (backend writes scores)
-- No authenticated INSERT policy — scores are system-generated

-- ============================================================
-- deliverables table RLS
-- ============================================================

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliverables_select_own"
  ON deliverables
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Owners can update status (approve/dismiss) but not insert raw deliverables
CREATE POLICY "deliverables_update_own"
  ON deliverables
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Insert is service-role only (AI agents create deliverables)

-- ============================================================
-- deliverable_status_log table RLS
-- ============================================================

ALTER TABLE deliverable_status_log ENABLE ROW LEVEL SECURITY;

-- Owners can read status log for their own deliverables
CREATE POLICY "dsl_select_own"
  ON deliverable_status_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliverables d
      WHERE d.id = deliverable_status_log.deliverable_id
        AND d.owner_id = auth.uid()
    )
  );

-- Owners can insert log entries (e.g., approve/dismiss actions from dashboard)
CREATE POLICY "dsl_insert_own"
  ON deliverable_status_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliverables d
      WHERE d.id = deliverable_status_log.deliverable_id
        AND d.owner_id = auth.uid()
    )
  );

-- Status log is immutable — no UPDATE or DELETE for authenticated users

-- ============================================================
-- subscriptions table RLS
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Subscriptions are written by Stripe webhook handler (service role)
-- Owners can read only

-- ============================================================
-- voice_profiles table RLS
-- ============================================================

ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_profiles_select_own"
  ON voice_profiles
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "voice_profiles_insert_own"
  ON voice_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "voice_profiles_update_own"
  ON voice_profiles
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- SERVICE ROLE NOTE
-- The Supabase service_role key bypasses ALL RLS policies.
-- All backend agents, cron jobs, and webhook handlers must use
-- the service_role client (supabaseAdmin), never the anon key.
-- ============================================================
