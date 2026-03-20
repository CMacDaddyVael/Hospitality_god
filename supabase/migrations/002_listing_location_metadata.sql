-- Migration: Add location and market metadata fields to listings table
-- Issue #151: Property location and market metadata extraction
-- Forward-only: existing rows will have NULL values for new fields (no backfill)

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS lat         FLOAT,
  ADD COLUMN IF NOT EXISTS lng         FLOAT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS state       TEXT,
  ADD COLUMN IF NOT EXISTS bedroom_count INT,
  ADD COLUMN IF NOT EXISTS max_guests  INT;

-- Index coordinates for geo-proximity queries used by competitive intel
CREATE INDEX IF NOT EXISTS listings_lat_lng_idx ON listings (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Index city + state for SEO/GEO targeting queries
CREATE INDEX IF NOT EXISTS listings_city_state_idx ON listings (city, state)
  WHERE city IS NOT NULL;

COMMENT ON COLUMN listings.lat           IS 'Latitude from listing page or Nominatim geocoding fallback';
COMMENT ON COLUMN listings.lng           IS 'Longitude from listing page or Nominatim geocoding fallback';
COMMENT ON COLUMN listings.city          IS 'City name extracted from listing location text or structured data';
COMMENT ON COLUMN listings.neighborhood  IS 'Neighborhood or area name from listing page';
COMMENT ON COLUMN listings.state         IS 'State / region extracted from listing location text';
COMMENT ON COLUMN listings.bedroom_count IS 'Number of bedrooms from listing page';
COMMENT ON COLUMN listings.max_guests    IS 'Maximum guest capacity from listing page';
