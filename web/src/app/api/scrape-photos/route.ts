import { NextRequest, NextResponse } from "next/server";
import { FirecrawlClient } from "@mendable/firecrawl-js";

export const maxDuration = 60;

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

function isPropertyPhoto(url: string): boolean {
  // Must match at least one include pattern
  const included = INCLUDE_PATTERNS.some((p) => p.test(url));
  if (!included) return false;

  // Must not match any exclude pattern
  const excluded = EXCLUDE_PATTERNS.some((p) => p.test(url));
  return !excluded;
}

/**
 * Normalize Airbnb CDN URLs:
 * - Strip query params (sizing transforms)
 * - Remove variant suffixes to deduplicate different sizes of same image
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep the path, strip query params for dedup
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Upgrade an Airbnb image URL to request the largest available version.
 * Airbnb CDN supports ?im_w= for width. Request 1200px wide.
 */
function upgradeToLargeFormat(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("im_w", "1200");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Extract all image URLs from raw text using multiple regex strategies.
 */
function extractImageUrls(text: string): string[] {
  const urls = new Set<string>();

  // 1. Airbnb CDN: a0.muscache.com/im/pictures/...
  const muscacheRe =
    /https?:\/\/a0\.muscache\.com\/im\/pictures\/[^\s)"'\]},]+/g;
  for (const m of text.matchAll(muscacheRe)) urls.add(m[0]);

  // 2. Airbnb CDN v2 path
  const muscacheV2Re =
    /https?:\/\/a0\.muscache\.com\/4ea\/air\/v2\/pictures\/[^\s)"'\]},]+/g;
  for (const m of text.matchAll(muscacheV2Re)) urls.add(m[0]);

  // 3. Airbnb ML-generated images
  const muscacheMlRe =
    /https?:\/\/a0\.muscache\.com\/im\/ml\/[^\s)"'\]},]+/g;
  for (const m of text.matchAll(muscacheMlRe)) urls.add(m[0]);

  // 4. Any muscache.com image URL
  const muscacheGenericRe =
    /https?:\/\/[a-z0-9]+\.muscache\.com\/[^\s)"'\]},]+\.(?:jpg|jpeg|png|webp)[^\s)"'\]},]*/gi;
  for (const m of text.matchAll(muscacheGenericRe)) urls.add(m[0]);

  // 5. Generic image URLs (jpg/jpeg/png/webp) — catch CDN aliases
  const genericRe =
    /https?:\/\/[^\s)"'\]},]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s)"'\]},]*)?/gi;
  for (const m of text.matchAll(genericRe)) urls.add(m[0]);

  // 6. Markdown image syntax: ![alt](url)
  const mdImgRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  for (const m of text.matchAll(mdImgRe)) urls.add(m[1]);

  // 7. Airbnb photo_id references — sometimes embedded in JSON data
  const photoIdRe =
    /https?:\/\/a0\.muscache\.com[^"'\s}\]]*?(?:photo_id|listing_id)[^"'\s}\]]*/g;
  for (const m of text.matchAll(photoIdRe)) urls.add(m[0]);

  return Array.from(urls);
}

/**
 * Extract property metadata from the page content.
 */
function extractPropertyInfo(
  markdown: string,
  metadata: Record<string, string>
) {
  const info: Record<string, string | number | null> = {};

  // Property name: from OG title, page title, or first heading
  info.name =
    metadata.ogTitle ||
    metadata.title ||
    (markdown.match(/^#\s+(.+)/m)?.[1] ?? null);

  // Clean up name — Airbnb titles often end with " - Airbnb"
  if (typeof info.name === "string") {
    info.name = info.name.replace(/\s*[-–—|]\s*Airbnb.*$/i, "").trim();
  }

  // Location: Airbnb puts it in the title or description
  const locationMatch =
    markdown.match(
      /(?:located in|in)\s+([A-Z][^.·\n]{3,60})/i
    )?.[1] ||
    metadata.ogTitle?.match(/in\s+([^-|·]+)/i)?.[1] ||
    null;
  info.location = typeof locationMatch === "string" ? locationMatch.trim() : null;

  // Bedrooms
  const bedroomMatch = markdown.match(/(\d+)\s*bedroom/i);
  info.bedrooms = bedroomMatch ? parseInt(bedroomMatch[1], 10) : null;

  // Bathrooms
  const bathroomMatch = markdown.match(/(\d+(?:\.5)?)\s*bath/i);
  info.bathrooms = bathroomMatch ? parseFloat(bathroomMatch[1]) : null;

  // Guests
  const guestMatch = markdown.match(/(\d+)\s*guest/i);
  info.maxGuests = guestMatch ? parseInt(guestMatch[1], 10) : null;

  // Beds
  const bedMatch = markdown.match(/(\d+)\s*bed(?!room)/i);
  info.beds = bedMatch ? parseInt(bedMatch[1], 10) : null;

  // Review score
  const ratingMatch =
    markdown.match(/(\d\.\d{1,2})\s*·?\s*\d+\s*review/i) ||
    markdown.match(/★\s*(\d\.\d{1,2})/);
  info.reviewScore = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  // Review count
  const reviewCountMatch = markdown.match(/(\d+)\s*reviews?/i);
  info.reviewCount = reviewCountMatch
    ? parseInt(reviewCountMatch[1], 10)
    : null;

  // Description
  info.description =
    metadata.description || metadata.ogDescription || null;

  // Property type
  const typeMatch = markdown.match(
    /(?:entire|private|shared)\s+(?:home|apartment|room|villa|condo|cabin|cottage|loft|house|studio|suite|guest\s+suite|bungalow|chalet|townhouse)/i
  );
  info.propertyType = typeMatch ? typeMatch[0].trim() : null;

  return info;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    // Validate it looks like an Airbnb URL
    const isAirbnb = /airbnb\.\w+\/rooms\//i.test(url);

    const firecrawl = new FirecrawlClient({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    // ─── Strategy 1: Scrape the listing page with extended wait ───
    const result = await firecrawl.scrape(url, {
      formats: ["markdown", "html"],
      waitFor: 10000, // 10s for full JS rendering including lazy-loaded images
    });

    const markdown = result.markdown || "";
    const html = result.html || "";
    const metadata = (result.metadata || {}) as Record<string, string>;

    // ─── Extract URLs from all available content ───
    const allRawUrls = new Set<string>();

    // From markdown content
    for (const u of extractImageUrls(markdown)) allRawUrls.add(u);

    // From raw HTML (catches URLs in data attributes, srcset, JSON-LD, etc.)
    for (const u of extractImageUrls(html)) allRawUrls.add(u);

    // From OG/meta images
    if (metadata.ogImage) allRawUrls.add(metadata.ogImage);
    if (metadata.image) allRawUrls.add(metadata.image);

    // Extract from srcset attributes (HTML has multiple sizes)
    const srcsetRe = /srcset="([^"]+)"/g;
    for (const m of html.matchAll(srcsetRe)) {
      const entries = m[1].split(",");
      for (const entry of entries) {
        const srcUrl = entry.trim().split(/\s+/)[0];
        if (srcUrl) allRawUrls.add(srcUrl);
      }
    }

    // Extract from data-original-uri and similar data attributes
    const dataAttrRe =
      /data-(?:original|src|uri|url|image)[^=]*="(https?:\/\/[^"]+)"/gi;
    for (const m of html.matchAll(dataAttrRe)) allRawUrls.add(m[1]);

    // Extract from JSON-LD structured data
    const jsonLdRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of html.matchAll(jsonLdRe)) {
      try {
        const jsonStr = m[1];
        // Pull any muscache URLs from the JSON
        for (const u of extractImageUrls(jsonStr)) allRawUrls.add(u);
      } catch {
        // ignore parse errors
      }
    }

    // Extract from inline JS/JSON (Airbnb embeds photo data in scripts)
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of html.matchAll(scriptRe)) {
      const scriptContent = m[1];
      // Only scan scripts that mention muscache (performance optimization)
      if (scriptContent.includes("muscache.com")) {
        for (const u of extractImageUrls(scriptContent)) allRawUrls.add(u);
      }
    }

    // ─── Filter to property photos only ───
    const seenNormalized = new Set<string>();
    const propertyPhotos: string[] = [];

    for (const rawUrl of allRawUrls) {
      // Clean up URL encoding artifacts
      const cleanUrl = rawUrl
        .replace(/\\u002F/g, "/")
        .replace(/\\u0026/g, "&")
        .replace(/\\/g, "");

      if (!isPropertyPhoto(cleanUrl)) continue;

      const normalized = normalizeUrl(cleanUrl);
      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);

      // Upgrade to large format
      propertyPhotos.push(upgradeToLargeFormat(cleanUrl));
    }

    // ─── Strategy 2: If we got very few photos, try the photo tour URL ───
    if (isAirbnb && propertyPhotos.length < 10) {
      // Airbnb has a dedicated photo gallery modal at /rooms/ID/photos
      const photoTourUrl = url.replace(
        /\/rooms\/(\d+).*/,
        "/rooms/$1/photos"
      );
      if (photoTourUrl !== url) {
        try {
          const tourResult = await firecrawl.scrape(photoTourUrl, {
            formats: ["markdown", "html"],
            waitFor: 10000,
          });

          const tourMarkdown = tourResult.markdown || "";
          const tourHtml = tourResult.html || "";

          for (const u of extractImageUrls(tourMarkdown)) {
            const clean = u.replace(/\\u002F/g, "/").replace(/\\/g, "");
            if (!isPropertyPhoto(clean)) continue;
            const norm = normalizeUrl(clean);
            if (seenNormalized.has(norm)) continue;
            seenNormalized.add(norm);
            propertyPhotos.push(upgradeToLargeFormat(clean));
          }

          for (const u of extractImageUrls(tourHtml)) {
            const clean = u.replace(/\\u002F/g, "/").replace(/\\/g, "");
            if (!isPropertyPhoto(clean)) continue;
            const norm = normalizeUrl(clean);
            if (seenNormalized.has(norm)) continue;
            seenNormalized.add(norm);
            propertyPhotos.push(upgradeToLargeFormat(clean));
          }
        } catch (e) {
          console.warn("Photo tour scrape failed, continuing with main page results:", e);
        }
      }
    }

    // ─── Extract property metadata ───
    const propertyInfo = extractPropertyInfo(markdown, metadata);

    return NextResponse.json({
      photos: propertyPhotos.slice(0, 50), // Up to 50 photos
      propertyInfo,
      total: propertyPhotos.length,
      source: isAirbnb ? "airbnb" : "generic",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Photo scrape error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
