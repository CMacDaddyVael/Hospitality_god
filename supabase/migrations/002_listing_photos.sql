-- Migration: 002_listing_photos
-- Creates the listing_photos table to store photo metadata
-- extracted by lib/scrapers/listing-photos.mjs
--
-- Each row represents one photo extracted from a listing.
-- Storage path points to Supabase Storage bucket: listing-photos/{listing_id}/{filename}

CREATE TABLE IF NOT EXISTS listing_photos (
  id              BIGSERIAL PRIMARY KEY,

  -- Derived from the listing URL (e.g. "airbnb_123456789")
  listing_id      TEXT        NOT NULL,

  -- Path within the "listing-photos" Supabase Storage bucket
  -- e.g. "airbnb_123456789/001_pictures_987654321.jpg"
  storage_path    TEXT        NOT NULL,

  -- Original CDN URL as scraped from Airbnb/Vrbo before normalization
  original_url    TEXT        NOT NULL,

  -- 0-based position in the listing's photo carousel
  display_order   INTEGER     NOT NULL DEFAULT 0,

  -- Inferred room type from image alt text (nullable)
  -- Values: bedroom, bathroom, kitchen, living_room, dining_room,
  --         outdoor, view, entrance, workspace, garage, or NULL
  room_type       TEXT        NULL,

  -- Timestamp when this photo was extracted and stored
  extracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate rows for the same photo in the same listing
  CONSTRAINT listing_photos_unique UNIQUE (listing_id, storage_path)
);

-- Index for fast lookups by listing
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_id
  ON listing_photos (listing_id);

-- Index to retrieve photos in carousel order
CREATE INDEX IF NOT EXISTS idx_listing_photos_order
  ON listing_photos (listing_id, display_order);

-- Index for filtering by room type (used by image generation pipeline)
CREATE INDEX IF NOT EXISTS idx_listing_photos_room_type
  ON listing_photos (listing_id, room_type)
  WHERE room_type IS NOT NULL;

-- Comments
COMMENT ON TABLE listing_photos IS
  'One row per property photo extracted by the listing-photos scraper module (Issue #222). Feeds the VAEL lifestyle image generation pipeline (Issue #214).';

COMMENT ON COLUMN listing_photos.listing_id IS
  'Stable identifier derived from the listing URL. Format: airbnb_{room_id} or vrbo_{property_id}.';

COMMENT ON COLUMN listing_photos.storage_path IS
  'Path within the listing-photos Supabase Storage bucket. Use supabase.storage.from("listing-photos").getPublicUrl(storage_path) to build a URL.';

COMMENT ON COLUMN listing_photos.original_url IS
  'Raw Airbnb/Vrbo CDN URL before normalization. Preserved for audit and debugging.';

COMMENT ON COLUMN listing_photos.room_type IS
  'Heuristically inferred room type from image alt text. NULL when not determinable.';
