/**
 * Shared photo filtering logic for Airbnb listing images.
 * Used by both /api/audit and /api/scrape-photos routes.
 *
 * RULE: Only property photos. No people, no graphics, no icons, no editorial.
 */

/* ─── Patterns to EXCLUDE (non-property images) ─── */
const EXCLUDE_PATTERNS = [
  /\/users\//i,
  /\/avatars?\//i,
  /\/profile/i,
  /platform[-_]?assets?/i,
  /icon/i,
  /badge/i,
  /logo/i,
  /\/map/i,
  /tiles/i,
  /sprite/i,
  /favicon/i,
  /emoji/i,
  /flag/i,
  /social[-_]?media/i,
  /google/i,
  /facebook/i,
  /twitter/i,
  /instagram/i,
  /superhost/i,
  /verified/i,
  /plus[-_]?badge/i,
  /amenity[-_]?icon/i,
  /payment/i,
  /visa|mastercard|amex|paypal/i,
  /\.svg$/i,
  /\.gif$/i,
  /1x1/i,
  /spacer/i,
  /pixel/i,
  /tracking/i,
  /analytics/i,
  /AirbnbPlatformAssets/i,
  /search[-_]?bar/i,
  /navigation/i,
  /category/i,
  /experiences/i,
  /im_w=\d{1,2}(?:&|$)/,
  /\/original\/\w{8,}-\w{4}-/i,
  /airbnb-platform/i,
];

/* ─── Patterns to INCLUDE (property photo CDN) ─── */
const INCLUDE_PATTERNS = [
  /a0\.muscache\.com\/im\/pictures\//,
  /a0\.muscache\.com\/4ea\/air\/v2\/pictures\//,
  /a0\.muscache\.com\/im\/ml\//,
  /muscache\.com\/.*\/original\//,
  /muscache\.com\/.*\/large\//,
  /airbnb.*\/pictures?\//i,
];

/* ─── Junk path segments ─── */
const JUNK_PATH_SEGMENTS = [
  "AirbnbPlatformAssets",
  "category",
  "amenities",
  "experiences",
  "airbnb-platform-assets",
  "search-bar",
  "navigation",
];

/* ─── People/editorial patterns ─── */
const PEOPLE_PATTERNS = [
  /\/User/i,
  /\/host/i,
  /\/portrait/i,
  /\/headshot/i,
  /\/editorial/i,
  /\/marketing/i,
  /\/graphic/i,
  /\/illustration/i,
  /\/infographic/i,
  /\/banner/i,
  /\/hero/i,
  /\/promo/i,
  /\/campaign/i,
];

export function isPropertyPhoto(url: string): boolean {
  // Must match at least one include pattern
  const included = INCLUDE_PATTERNS.some((p) => p.test(url));
  if (!included) return false;

  // Must not match any exclude pattern
  const excluded = EXCLUDE_PATTERNS.some((p) => p.test(url));
  if (excluded) return false;

  const path = url.split("?")[0];

  // Must have a long enough path (real listing photos do)
  const hasLongPath = path.split("/").filter((s) => s.length > 0).length >= 5;
  if (!hasLongPath) return false;

  // No junk path segments
  if (JUNK_PATH_SEGMENTS.some((seg) => url.includes(seg))) return false;

  // No people/editorial photos
  if (PEOPLE_PATTERNS.some((p) => p.test(url))) return false;

  // Airbnb CDN: require "Hosting-" in path — the strongest signal for actual listing photos
  const isAirbnbCdn = /muscache\.com/i.test(url);
  if (isAirbnbCdn) {
    const hasHostingPath = /Hosting-\d+/i.test(url);
    const hasMediaPath =
      /\/im\/pictures\//i.test(url) ||
      /\/4ea\/air\/v2\/pictures\//i.test(url);
    if (hasMediaPath && !hasHostingPath) return false;
  }

  return true;
}

/**
 * Clean up URL encoding artifacts from scraped content.
 */
export function cleanImageUrl(url: string): string {
  return url
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\/g, "");
}

/**
 * Normalize URL for deduplication (strip query params).
 */
export function normalizePhotoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Upgrade to large format (1200px wide).
 */
export function upgradeToLargeFormat(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("im_w", "1200");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Filter an array of raw image URLs down to only property photos.
 * Deduplicates and upgrades to large format.
 */
export function filterPropertyPhotos(rawUrls: string[]): string[] {
  const seenNormalized = new Set<string>();
  const results: string[] = [];

  for (const rawUrl of rawUrls) {
    const cleanUrl = cleanImageUrl(rawUrl);

    if (!isPropertyPhoto(cleanUrl)) continue;

    const normalized = normalizePhotoUrl(cleanUrl);
    if (seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);

    results.push(upgradeToLargeFormat(cleanUrl));
  }

  return results;
}
