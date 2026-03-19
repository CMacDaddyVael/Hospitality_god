/**
 * Airbnb Data Ingestion Layer
 * 
 * Pulls listing data and reviews from Airbnb using their internal API
 * (same endpoints the web app uses). Stores results in Supabase.
 * 
 * FRAGILITY WARNING: Airbnb can change their API at any time.
 * All fetch calls are wrapped with error handling and logged to agent_tasks.
 * If this breaks, the fallback is the manual scrape path documented below.
 * 
 * FALLBACK (manual): If auto-sync fails, the owner can paste their listing URL
 * at /onboarding or /dashboard/listings and we trigger a one-shot scrape via
 * POST /api/onboarding/scrape-listing — no auth required for public data.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Per-account rate limit: 1 request per 3 seconds
const lastRequestTime = new Map(); // accountId -> timestamp

async function rateLimitedFetch(accountId, fetchFn) {
  const now = Date.now();
  const last = lastRequestTime.get(accountId) || 0;
  const elapsed = now - last;
  const MIN_INTERVAL_MS = 3000;

  if (elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    await sleep(wait);
  }

  lastRequestTime.set(accountId, Date.now());
  return fetchFn();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Auth credential retrieval ────────────────────────────────────────────────

/**
 * Retrieves stored Airbnb auth credentials for a property from Supabase.
 * Credentials are stored in the `property_credentials` table as:
 * { airbnb_session_cookie, airbnb_oauth_token, airbnb_user_id }
 */
async function getCredentials(propertyId) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('property_credentials')
    .select('airbnb_session_cookie, airbnb_oauth_token, airbnb_user_id')
    .eq('property_id', propertyId)
    .single();

  if (error) {
    throw new AirbnbAuthError(`No credentials found for property ${propertyId}: ${error.message}`);
  }

  if (!data.airbnb_session_cookie && !data.airbnb_oauth_token) {
    throw new AirbnbAuthError(`Property ${propertyId} has no Airbnb auth tokens`);
  }

  return data;
}

/**
 * Build request headers from stored credentials.
 * Airbnb's internal API accepts either a session cookie or an OAuth token.
 */
function buildAuthHeaders(credentials) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Airbnb-API-Key': 'd306zoyjsyarp7ifhu67rjxn52tv0t20', // Public key embedded in Airbnb web app
    'Content-Type': 'application/json',
  };

  if (credentials.airbnb_session_cookie) {
    headers['Cookie'] = credentials.airbnb_session_cookie;
  }

  if (credentials.airbnb_oauth_token) {
    headers['X-Airbnb-OAuth-Token'] = credentials.airbnb_oauth_token;
  }

  return headers;
}

// ─── Custom error types ───────────────────────────────────────────────────────

class AirbnbAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AirbnbAuthError';
    this.code = 'AUTH_FAILURE';
  }
}

class AirbnbRateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AirbnbRateLimitError';
    this.code = 'RATE_LIMITED';
  }
}

class AirbnbNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AirbnbNotFoundError';
    this.code = 'LISTING_NOT_FOUND';
  }
}

// ─── Airbnb API helpers ───────────────────────────────────────────────────────

const AIRBNB_API_BASE = 'https://www.airbnb.com/api/v3';

/**
 * Make an authenticated request to Airbnb's internal GraphQL or REST API.
 * Handles HTTP error codes and maps them to typed errors.
 */
async function airbnbFetch(url, headers, accountId) {
  return rateLimitedFetch(accountId || 'global', async () => {
    let response;
    try {
      response = await fetch(url, { headers, redirect: 'follow' });
    } catch (networkErr) {
      throw new Error(`Network error calling Airbnb: ${networkErr.message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AirbnbAuthError(`Airbnb returned ${response.status} — session may be expired`);
    }

    if (response.status === 429) {
      throw new AirbnbRateLimitError('Airbnb rate limit hit — back off and retry');
    }

    if (response.status === 404) {
      throw new AirbnbNotFoundError(`Airbnb returned 404 — listing may not exist or be unlisted`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Airbnb API error ${response.status}: ${body.slice(0, 200)}`);
    }

    return response.json();
  });
}

// ─── Listing fetcher ──────────────────────────────────────────────────────────

/**
 * Fetches listing data for a given Airbnb listing ID.
 * Uses Airbnb's PdpPlatformSections GraphQL operation (same as their web app).
 * 
 * @param {string} airbnbListingId  - Numeric Airbnb listing ID
 * @param {string} propertyId       - Our internal property ID (for credential lookup)
 * @returns {{ title, description, photos, amenities, avgRating, reviewCount, lastUpdated }}
 */
export async function fetchListing(airbnbListingId, propertyId) {
  const credentials = await getCredentials(propertyId);
  const headers = buildAuthHeaders(credentials);
  const accountId = credentials.airbnb_user_id || propertyId;

  // Airbnb's internal listing detail endpoint (v2 PDP API)
  const params = new URLSearchParams({
    operationName: 'PdpPlatformSections',
    locale: 'en',
    currency: 'USD',
    variables: JSON.stringify({
      id: airbnbListingId,
      pdpSectionsRequest: {
        adults: '1',
        bypassTargetings: false,
        categoryTag: null,
        causeId: null,
        disasterId: null,
        discountedGuestFeeVersion: null,
        displayExtensions: null,
        federatedSearchId: null,
        forceBoostPriorityMessageType: null,
        hostPreview: false,
        houseRules: false,
        layouts: ['SIDEBAR', 'SINGLE_COLUMN'],
        pdpTypeOverride: null,
        preview: false,
        previousStateCheckIn: null,
        previousStateCheckOut: null,
        priceDropSource: null,
        privateBooking: false,
        promotionUuid: null,
        relaxedAmenityIds: null,
        screenSize: 'LARGE',
        searchId: null,
        selectedCancellationPolicyId: null,
        translateUgc: null,
        useNewSectionComponentIds: false,
      },
    }),
    extensions: JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash: '6aa9b037a43da62a5e40a29db00b1d6e7fd2fcf72f10e21e77a77c99bb16b5d4',
      },
    }),
  });

  const url = `${AIRBNB_API_BASE}/PdpPlatformSections?${params}`;
  const data = await airbnbFetch(url, headers, accountId);

  return parseListing(data, airbnbListingId);
}

/**
 * Parses the raw Airbnb API response into our structured format.
 * This is the most fragile part — Airbnb changes their response shape often.
 */
function parseListing(data, airbnbListingId) {
  try {
    const sections = data?.data?.presentation?.stayProductDetailPage?.sections?.sections || [];

    // Extract title from TITLE section or metadata
    let title = '';
    let description = '';
    let photos = [];
    let amenities = [];
    let avgRating = 0;
    let reviewCount = 0;

    // Try metadata first (most reliable)
    const metadata = data?.data?.presentation?.stayProductDetailPage?.sections?.metadata;
    if (metadata) {
      title = metadata.sharingConfig?.title || metadata.seoFeatures?.title || '';
      description = metadata.sharingConfig?.description || '';
      avgRating = parseFloat(metadata.sharingConfig?.starRating) || 0;
    }

    // Walk sections for richer data
    for (const section of sections) {
      const sectionData = section?.section;
      if (!sectionData) continue;

      const type = sectionData.__typename || '';

      // Title
      if (type === 'PdpTitleSection' && !title) {
        title = sectionData.title || '';
      }

      // Description / About
      if (type === 'PdpDescriptionSection' || type === 'PdpHighlightsSection') {
        if (sectionData.htmlDescription?.htmlText && !description) {
          // Strip HTML tags from description
          description = sectionData.htmlDescription.htmlText.replace(/<[^>]+>/g, '').trim();
        }
      }

      // Photos
      if (type === 'PdpPhotoTourSection' || type === 'PdpPhotoSection') {
        const mediaItems = sectionData.mediaItems || sectionData.photos || [];
        photos = mediaItems
          .filter((m) => m?.baseUrl || m?.url || m?.picture?.url)
          .map((m) => ({
            url: m.baseUrl || m.url || m.picture?.url || '',
            caption: m.caption || m.accessibilityLabel || '',
          }));
      }

      // Amenities
      if (type === 'PdpAmenitiesSection') {
        const groups = sectionData.seeAllAmenitiesGroups || [];
        for (const group of groups) {
          for (const amenity of group.amenities || []) {
            if (amenity.available !== false) {
              amenities.push(amenity.title || amenity.name || '');
            }
          }
        }
      }

      // Ratings
      if (type === 'PdpReviewsSection' || type === 'PdpRatingsSection') {
        if (!avgRating && sectionData.overallRating) {
          avgRating = parseFloat(sectionData.overallRating) || 0;
        }
        if (!reviewCount && sectionData.totalReviewCount) {
          reviewCount = parseInt(sectionData.totalReviewCount) || 0;
        }
      }
    }

    // Fallback: try top-level listing data
    const listing = data?.data?.presentation?.stayProductDetailPage?.listing;
    if (listing) {
      title = title || listing.name || '';
      avgRating = avgRating || parseFloat(listing.avgRating) || 0;
      reviewCount = reviewCount || parseInt(listing.reviewsCount) || 0;
    }

    if (!title) {
      throw new Error(`Could not parse title from Airbnb response for listing ${airbnbListingId}`);
    }

    return {
      airbnbListingId,
      title,
      description,
      photos: photos.slice(0, 50), // cap at 50 photos
      amenities: [...new Set(amenities.filter(Boolean))], // deduplicate
      avgRating: Math.round(avgRating * 100) / 100,
      reviewCount,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof AirbnbAuthError || err instanceof AirbnbNotFoundError) throw err;
    throw new Error(`Failed to parse listing data: ${err.message}`);
  }
}

// ─── Review fetcher ───────────────────────────────────────────────────────────

/**
 * Fetches recent reviews for a listing since a given date.
 * Uses Airbnb's PdpReviews endpoint (paginated).
 * 
 * @param {string} airbnbListingId  - Numeric Airbnb listing ID
 * @param {string} propertyId       - Our internal property ID
 * @param {Date}   sinceDate        - Fetch reviews on or after this date
 * @returns {Array<{ reviewId, guestName, rating, text, date }>}
 */
export async function fetchReviews(airbnbListingId, propertyId, sinceDate) {
  const credentials = await getCredentials(propertyId);
  const headers = buildAuthHeaders(credentials);
  const accountId = credentials.airbnb_user_id || propertyId;

  const since = sinceDate instanceof Date ? sinceDate : new Date(sinceDate);
  const allReviews = [];
  let offset = 0;
  const limit = 7; // Airbnb's default page size for reviews
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      operationName: 'PdpReviews',
      locale: 'en',
      currency: 'USD',
      variables: JSON.stringify({
        id: airbnbListingId,
        pdpReviewsRequest: {
          fieldSelector: 'for_p3',
          forPreview: false,
          limit,
          offset,
          showingTranslationButton: false,
          first: limit,
          after: offset > 0 ? String(offset) : null,
        },
      }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: 'f50f8ee2a8b1e81ccbbb665d7354eded8e8f98f74ef01cd5ede3e5d93312a3cd',
        },
      }),
    });

    const url = `${AIRBNB_API_BASE}/PdpReviews?${params}`;
    const data = await airbnbFetch(url, headers, accountId);

    const parsed = parseReviewsPage(data);

    if (parsed.reviews.length === 0) {
      hasMore = false;
      break;
    }

    for (const review of parsed.reviews) {
      const reviewDate = new Date(review.date);
      if (reviewDate < since) {
        // Reviews are returned newest-first; once we go past sinceDate, stop
        hasMore = false;
        break;
      }
      allReviews.push(review);
    }

    if (hasMore) {
      hasMore = parsed.hasNextPage;
      offset += limit;
    }

    // Safety cap: don't fetch more than 500 reviews in one run
    if (allReviews.length >= 500) {
      hasMore = false;
    }
  }

  return allReviews;
}

/**
 * Parses a single page of review results.
 */
function parseReviewsPage(data) {
  try {
    const reviewsData =
      data?.data?.presentation?.stayProductDetailPage?.reviews ||
      data?.data?.merlin?.pdpReviews;

    const reviews = [];
    const rawReviews =
      reviewsData?.reviews ||
      reviewsData?.filteredReviews ||
      [];

    for (const raw of rawReviews) {
      if (!raw) continue;

      const reviewId = String(raw.id || raw.reviewId || '');
      const guestName = raw.reviewer?.firstName ||
        raw.author?.firstName ||
        raw.localizedDate?.split(' ')[0] ||
        'Guest';
      const rating = parseInt(raw.rating) || 0;
      const text = raw.comments || raw.localizedComments || raw.response || '';
      const date = raw.createdAt || raw.localizedDate || raw.date || '';

      if (reviewId && text) {
        reviews.push({ reviewId, guestName, rating, text, date: normalizeDate(date) });
      }
    }

    const hasNextPage =
      reviewsData?.paginationInfo?.hasNextPage ||
      reviewsData?.canLoadMore ||
      false;

    return { reviews, hasNextPage };
  } catch (err) {
    throw new Error(`Failed to parse reviews page: ${err.message}`);
  }
}

/**
 * Normalize various date formats Airbnb returns to ISO 8601.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Supabase upsert helpers ──────────────────────────────────────────────────

/**
 * Upserts listing data into the `listings` table.
 */
export async function upsertListing(propertyId, listingData) {
  const supabase = getSupabase();

  const { error } = await supabase.from('listings').upsert(
    {
      property_id: propertyId,
      airbnb_listing_id: listingData.airbnbListingId,
      title: listingData.title,
      description: listingData.description,
      photos: listingData.photos,
      amenities: listingData.amenities,
      avg_rating: listingData.avgRating,
      review_count: listingData.reviewCount,
      platform: 'airbnb',
      last_synced_at: new Date().toISOString(),
      raw_data: listingData,
    },
    {
      onConflict: 'property_id,platform',
      ignoreDuplicates: false,
    }
  );

  if (error) throw new Error(`Failed to upsert listing: ${error.message}`);
}

/**
 * Upserts an array of reviews into the `reviews` table.
 * Uses airbnb_review_id as the conflict key so re-runs are idempotent.
 */
export async function upsertReviews(propertyId, reviews) {
  if (!reviews.length) return;
  const supabase = getSupabase();

  const rows = reviews.map((r) => ({
    property_id: propertyId,
    airbnb_review_id: r.reviewId,
    guest_name: r.guestName,
    rating: r.rating,
    text: r.text,
    review_date: r.date,
    platform: 'airbnb',
    last_synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('reviews').upsert(rows, {
    onConflict: 'airbnb_review_id',
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`Failed to upsert reviews: ${error.message}`);
}

// ─── Agent task logger ────────────────────────────────────────────────────────

/**
 * Logs sync status and errors to the `agent_tasks` table so the dashboard
 * and orchestrator can see what happened.
 */
async function logAgentTask(propertyId, taskType, status, detail = {}) {
  try {
    const supabase = getSupabase();
    await supabase.from('agent_tasks').insert({
      property_id: propertyId,
      task_type: taskType,
      status,
      detail: JSON.stringify(detail),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Don't let logging failures crash the sync
    console.error('[airbnb] Failed to log agent task:', err.message);
  }
}

// ─── Full property sync ───────────────────────────────────────────────────────

/**
 * Runs a full sync for a single property: listing data + last-90-days reviews.
 * Catches and logs all errors — never throws, so the scheduler doesn't crash.
 * 
 * @param {{ id: string, airbnb_listing_id: string }} property
 * @returns {{ success: boolean, error?: string }}
 */
export async function syncProperty(property) {
  const { id: propertyId, airbnb_listing_id: airbnbListingId } = property;

  console.log(`[airbnb] Starting sync for property ${propertyId} (listing ${airbnbListingId})`);

  // ── Listing data ────────────────────────────────────────────────────────────
  try {
    const listing = await fetchListing(airbnbListingId, propertyId);
    await upsertListing(propertyId, listing);
    console.log(`[airbnb] ✓ Listing synced: "${listing.title}" (${listing.reviewCount} reviews, ${listing.avgRating}★)`);
    await logAgentTask(propertyId, 'airbnb_listing_sync', 'success', {
      title: listing.title,
      avgRating: listing.avgRating,
      reviewCount: listing.reviewCount,
    });
  } catch (err) {
    const isKnown = err instanceof AirbnbAuthError ||
      err instanceof AirbnbRateLimitError ||
      err instanceof AirbnbNotFoundError;
    console.error(`[airbnb] ✗ Listing sync failed for ${propertyId}:`, err.message);
    await logAgentTask(propertyId, 'airbnb_listing_sync', 'error', {
      error: err.message,
      code: err.code || 'UNKNOWN',
    });
    if (!isKnown) {
      // Unknown errors might be transient — continue to try reviews anyway
    } else {
      // Auth/not-found errors won't recover on reviews either
      return { success: false, error: err.message };
    }
  }

  // ── Reviews (last 90 days) ─────────────────────────────────────────────────
  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const reviews = await fetchReviews(airbnbListingId, propertyId, since);
    await upsertReviews(propertyId, reviews);
    console.log(`[airbnb] ✓ Reviews synced: ${reviews.length} reviews since ${since.toDateString()}`);
    await logAgentTask(propertyId, 'airbnb_review_sync', 'success', {
      reviewCount: reviews.length,
      since: since.toISOString(),
    });
  } catch (err) {
    console.error(`[airbnb] ✗ Review sync failed for ${propertyId}:`, err.message);
    await logAgentTask(propertyId, 'airbnb_review_sync', 'error', {
      error: err.message,
      code: err.code || 'UNKNOWN',
    });
    return { success: false, error: err.message };
  }

  return { success: true };
}

// ─── Batch sync (all active properties) ──────────────────────────────────────

/**
 * Syncs all active properties that have an Airbnb listing ID.
 * Called by the cron workflow and the CLI script.
 * 
 * @returns {{ synced: number, failed: number, results: Array }}
 */
export async function syncAllProperties() {
  const supabase = getSupabase();

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, airbnb_listing_id, name')
    .eq('active', true)
    .not('airbnb_listing_id', 'is', null);

  if (error) throw new Error(`Failed to fetch properties: ${error.message}`);
  if (!properties?.length) {
    console.log('[airbnb] No active properties with Airbnb listings found');
    return { synced: 0, failed: 0, results: [] };
  }

  console.log(`[airbnb] Syncing ${properties.length} properties...`);

  const results = [];
  let synced = 0;
  let failed = 0;

  for (const property of properties) {
    const result = await syncProperty(property);
    results.push({ propertyId: property.id, name: property.name, ...result });
    if (result.success) {
      synced++;
    } else {
      failed++;
    }
    // Extra courtesy delay between properties (on top of per-request rate limit)
    await sleep(1000);
  }

  console.log(`[airbnb] Sync complete: ${synced} succeeded, ${failed} failed`);
  return { synced, failed, results };
}

// ─── Public scrape fallback (no auth required) ────────────────────────────────

/**
 * FALLBACK: Scrapes a public Airbnb listing URL without authentication.
 * Used when the owner's credentials are unavailable or invalid.
 * Only returns publicly visible data — no private owner data.
 * 
 * This is also called from /api/onboarding/scrape-listing during onboarding.
 * 
 * @param {string} listingUrl  - Full Airbnb listing URL
 * @returns {{ title, description, photos, amenities, avgRating, reviewCount }}
 */
export async function scrapePublicListing(listingUrl) {
  const listingIdMatch = listingUrl.match(/airbnb\.com\/rooms\/(\d+)/);
  if (!listingIdMatch) {
    throw new Error('Invalid Airbnb URL — expected format: airbnb.com/rooms/XXXXXXXX');
  }

  const listingId = listingIdMatch[1];
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  let response;
  try {
    response = await fetch(listingUrl, { headers, redirect: 'follow' });
  } catch (err) {
    throw new Error(`Network error fetching listing page: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Airbnb returned ${response.status} for ${listingUrl}`);
  }

  const html = await response.text();
  return parsePublicListingHtml(html, listingId);
}

/**
 * Parses the Next.js __NEXT_DATA__ JSON embedded in Airbnb's HTML.
 * This is more stable than CSS-selector scraping.
 */
function parsePublicListingHtml(html, listingId) {
  // Extract the __NEXT_DATA__ JSON blob
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not find __NEXT_DATA__ in Airbnb page — structure may have changed');
  }

  let nextData;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    throw new Error('Failed to parse __NEXT_DATA__ JSON from Airbnb page');
  }

  // Navigate the Next.js page props — path varies by Airbnb page version
  const props =
    nextData?.props?.pageProps ||
    nextData?.props ||
    {};

  const listing =
    props?.listing ||
    props?.bootstrapData?.reduxData?.homePDP?.listingInfo?.listing ||
    {};

  const title = listing.name || listing.public_address || '';
  const description = listing.description || listing.summary || '';

  const photos = (listing.photos || listing.listing_photos || []).map((p) => ({
    url: p.xx_large || p.x_large || p.large || p.medium || p.url || '',
    caption: p.caption || '',
  }));

  const amenities = (listing.listing_amenities || listing.amenity_ids || [])
    .filter((a) => a?.name || typeof a === 'string')
    .map((a) => (typeof a === 'string' ? a : a.name));

  const avgRating = parseFloat(listing.avg_rating || listing.star_rating || 0);
  const reviewCount = parseInt(listing.reviews_count || listing.review_count || 0);

  return {
    airbnbListingId: listingId,
    title,
    description,
    photos: photos.slice(0, 50),
    amenities: [...new Set(amenities.filter(Boolean))],
    avgRating: Math.round(avgRating * 100) / 100,
    reviewCount,
    lastUpdated: new Date().toISOString(),
    source: 'public_scrape',
  };
}
