-- Add subscription tracking fields to the profiles table
-- These are written by the Stripe webhook handler and read by middleware

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_tier    TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- Index for fast customer lookups in the webhook handler
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Index for subscription status checks in middleware
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON profiles (subscription_status);

COMMENT ON COLUMN profiles.subscription_status IS
  'active | inactive — kept in sync by Stripe webhook handler';

COMMENT ON COLUMN profiles.subscription_tier IS
  'free | pro — upgraded to pro on successful checkout, downgraded on cancellation/failure';

COMMENT ON COLUMN profiles.stripe_customer_id IS
  'Stripe Customer ID (cus_xxx) — set on first successful checkout';

COMMENT ON COLUMN profiles.stripe_subscription_id IS
  'Stripe Subscription ID (sub_xxx) — set on first successful checkout';
