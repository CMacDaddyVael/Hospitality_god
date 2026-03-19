-- Guest Communication Sequence Engine Schema
-- Run this in Supabase SQL editor

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  airbnb_listing_id TEXT,
  airbnb_listing_url TEXT,
  description TEXT,
  check_in_instructions TEXT,
  wifi_password TEXT,
  amenities JSONB DEFAULT '[]',
  house_rules TEXT,
  review_page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  airbnb_reservation_id TEXT UNIQUE,
  airbnb_thread_id TEXT,
  guest_name TEXT NOT NULL,
  guest_first_name TEXT GENERATED ALWAYS AS (split_part(guest_name, ' ', 1)) STORED,
  guest_airbnb_id TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  num_guests INTEGER DEFAULT 1,
  total_price NUMERIC(10,2),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message sequence configurations per property
CREATE TABLE IF NOT EXISTS sequence_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('pre_arrival', 'check_in', 'mid_stay', 'post_stay')),
  enabled BOOLEAN DEFAULT true,
  mode TEXT DEFAULT 'approve' CHECK (mode IN ('auto', 'approve')),
  -- Timing offsets (in hours relative to check-in or check-out)
  send_offset_hours INTEGER NOT NULL, -- negative = before check-in, positive = after check-out
  send_time_hour INTEGER DEFAULT 10 CHECK (send_time_hour BETWEEN 0 AND 23), -- hour of day to send (local time)
  custom_template TEXT, -- owner-edited template (null = use AI)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, step)
);

-- Default sequence configs (inserted when property is created)
-- pre_arrival: 3 days before check-in = -72 hours
-- check_in: day of check-in = 0 hours
-- mid_stay: day 2 of stay = 24 hours after check-in
-- post_stay: 24 hours after checkout

-- Scheduled messages (one per booking per step)
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_config_id UUID REFERENCES sequence_configs(id),
  step TEXT NOT NULL CHECK (step IN ('pre_arrival', 'check_in', 'mid_stay', 'post_stay')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  mode TEXT DEFAULT 'approve' CHECK (mode IN ('auto', 'approve')),
  -- Message content
  ai_draft TEXT, -- AI-generated draft
  final_message TEXT, -- what actually gets sent (owner-edited or ai_draft)
  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  airbnb_message_id TEXT, -- ID from Airbnb after delivery
  -- Owner interaction
  owner_approved_at TIMESTAMPTZ,
  owner_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airbnb sessions (stored credentials for delivery)
CREATE TABLE IF NOT EXISTS airbnb_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cookies JSONB, -- encrypted session cookies
  user_agent TEXT,
  last_verified_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'invalid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in_date ON bookings(check_in_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_booking_id ON scheduled_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_owner_id ON scheduled_messages(owner_id);

-- RLS Policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE airbnb_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_own_properties" ON properties
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "owners_own_bookings" ON bookings
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "owners_own_sequence_configs" ON sequence_configs
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "owners_own_scheduled_messages" ON scheduled_messages
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "owners_own_airbnb_sessions" ON airbnb_sessions
  FOR ALL USING (auth.uid() = owner_id);

-- Service role bypass (for cron jobs)
CREATE POLICY "service_role_all_properties" ON properties
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_all_bookings" ON bookings
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_all_sequence_configs" ON sequence_configs
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_all_scheduled_messages" ON scheduled_messages
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_all_airbnb_sessions" ON airbnb_sessions
  FOR ALL TO service_role USING (true);
