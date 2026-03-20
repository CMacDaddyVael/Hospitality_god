/**
 * Competitive Intelligence Scraper — Issue #148
 *
 * Scrapes top Airbnb listings in the same market as the owner's property.
 * Uses Cheerio for HTML parsing. This is ADDITIVE — does not touch Issue #105 scraper.
 *
 * Strategy: Airbnb's public search page embeds listing data as JSON-LD and
 * inline __NEXT_DATA__ / bootstrap scripts. We parse those for reliable
 * structured data without full JS execution where possible, falling back to
 * HTML attribute scraping.
 */

import * as cheerio from 'cheerio';

const AIRBNB_BASE = 'https://www.airbnb.com';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_COMPETITORS = 10;
const MIN_COMPETITORS = 5;

/**
 * Fetch HTML from a URL with browser-like headers.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
async function fetchHtml(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempt to extract embedded __NEXT_DATA__ JSON from an Airbnb page.
 * @param {string} html
 * @returns {object|null}
 */
function extractNextData(html) {
  try {
    const $ = cheerio.load(html);
    const scriptContent = $('#__NEXT_DATA__').html();
    if (scriptContent) {
      return JSON.parse(scriptContent);
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/**
 * Build the Airbnb search URL for a given location and bedroom count.
 * @param {string} location  - City or area string (e.g. "Scottsdale, AZ")
 * @param {number} bedrooms  - Number of bedrooms
 * @returns {string}
 */
function buildSearchUrl(location, bedrooms) {
  const params = new URLSearchParams({
    query: location,
    adults: String(Math.max(2, bedrooms * 2)),  // reasonable guest count
    min_bedrooms: String(Math.max(1, bedrooms - 1)),
    max_bedrooms: String(bedrooms + 1),
    room_types: 'Entire home/apt',
    tab_id: 'home_tab',
    refinement_paths: '/homes',
    search_type: 'autocomplete_click',
  });

  return `${AIRBNB_BASE}/s/${encodeURIComponent(location)}/homes?${params.toString()}`;
}

/**
 * Parse listing cards from search result HTML.
 * Attempts __NEXT_DATA__ first, falls back to HTML scraping.
 *
 * @param {string} html
 * @returns {Array<{listingId: string, url: string}>}
 */
function parseSearchResultIds(html) {
  // Try __NEXT_DATA__ structured extraction first
  const nextData = extractNextData(html);
  if (nextData) {
    try {
      const results = extractListingIdsFromNextData(nextData);
      if (results.length >= MIN_COMPETITORS) {
        return results;
      }
    } catch {
      // fall through to HTML scraping
    }
  }

  // Fallback: scrape listing links from HTML
  return extractListingIdsFromHtml(html);
}

/**
 * Extract listing IDs from Airbnb's __NEXT_DATA__ structure.
 * The path varies by page version; we try multiple known paths.
 * @param {object} nextData
 * @returns {Array<{listingId: string, url: string}>}
 */
function extractListingIdsFromNextData(nextData) {
  const results = [];
  const seen = new Set();

  // Walk common paths where Airbnb embeds search results
  const candidates = [
    nextData?.props?.pageProps?.searchResults,
    nextData?.props?.pageProps?.staysSearch?.results,
    nextData?.props?.pageProps?.exploreData?.sections,
  ].filter(Boolean);

  for (const candidate of candidates) {
    extractListingIdsFromObject(candidate, results, seen);
    if (results.length >= MAX_COMPETITORS) break;
  }

  return results.slice(0, MAX_COMPETITORS);
}

/**
 * Recursively walk an object looking for listing ID patterns.
 */
function extractListingIdsFromObject(obj, results, seen) {
  if (!obj || typeof obj !== 'object' || results.length >= MAX_COMPETITORS) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractListingIdsFromObject(item, results, seen);
    }
    return;
  }

  // Look for id patterns that match Airbnb listing IDs
  const id = obj.id || obj.listingId || obj.listing?.id;
  if (id && /^\d{5,12}$/.test(String(id)) && !seen.has(String(id))) {
    const listingId = String(id);
    seen.add(listingId);
    results.push({
      listingId,
      url: `${AIRBNB_BASE}/rooms/${listingId}`,
    });
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      extractListingIdsFromObject(value, results, seen);
    }
  }
}

/**
 * Fallback: extract listing IDs from anchor href attributes in HTML.
 * @param {string} html
 * @returns {Array<{listingId: string, url: string}>}
 */
function extractListingIdsFromHtml(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  // Airbnb search cards link to /rooms/NNNNNNNN
  $('a[href*="/rooms/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/rooms\/(\d{5,12})/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      results.push({
        listingId: match[1],
        url: `${AIRBNB_BASE}/rooms/${match[1]}`,
      });
    }
    if (results.length >= MAX_COMPETITORS) return false; // break
  });

  return results;
}

/**
 * Scrape an individual Airbnb listing page for competitor data.
 * @param {string} listingId
 * @param {string} url
 * @returns {Promise<import('./types.mjs').CompetitorListing>}
 */
async function scrapeListingDetail(listingId, url) {
  let html;
  try {
    html = await fetchHtml(url);
  } catch (err) {
    console.warn(`[CompetitorScraper] Failed to fetch listing ${listingId}: ${err.message}`);
    return buildFallbackListing(listingId, url);
  }

  const nextData = extractNextData(html);
  const $ = cheerio.load(html);

  let title = null;
  let nightlyPrice = null;
  let reviewCount = null;
  let reviewScore = null;
  let photoCount = 0;
  let topAmenities = [];
  let bedroomCount = null;
  let location = '';

  // --- Extract from __NEXT_DATA__ (most reliable) ---
  if (nextData) {
    try {
      const listing =
        nextData?.props?.pageProps?.listingData?.listing ||
        nextData?.props?.pageProps?.listing ||
        nextData?.props?.pageProps?.pdpData?.sections?.find(
          (s) => s?.sectionId === 'OVERVIEW_DEFAULT'
        );

      // Title
      title =
        nextData?.props?.pageProps?.listingData?.listing?.name ||
        nextData?.props?.pageProps?.listing?.name ||
        null;

      // Pricing — look for price in various locations
      const pricingData =
        nextData?.props?.pageProps?.listingData?.price ||
        nextData?.props?.pageProps?.price;
      if (pricingData?.rate?.amount) {
        nightlyPrice = parseFloat(pricingData.rate.amount);
      }

      // Reviews
      const reviewsData =
        nextData?.props?.pageProps?.listingData?.listing?.reviews ||
        nextData?.props?.pageProps?.listing?.reviews;
      if (reviewsData) {
        reviewCount = reviewsData.count ?? reviewsData.reviewsCount ?? null;
        reviewScore = reviewsData.rating ?? reviewsData.guestSatisfactionOverall ?? null;
      }

      // Photos
      const photosData =
        nextData?.props?.pageProps?.listingData?.listing?.photos ||
        nextData?.props?.pageProps?.listing?.photos;
      if (Array.isArray(photosData)) {
        photoCount = photosData.length;
      }

      // Amenities
      const amenitiesData =
        nextData?.props?.pageProps?.listingData?.listing?.listingAmenities ||
        nextData?.props?.pageProps?.listing?.listingAmenities ||
        [];
      if (Array.isArray(amenitiesData)) {
        topAmenities = amenitiesData
          .filter((a) => a?.available !== false)
          .map((a) => a?.name || a?.title || '')
          .filter(Boolean)
          .slice(0, 5);
      }

      // Bedrooms
      bedroomCount =
        nextData?.props?.pageProps?.listingData?.listing?.bedrooms ?? null;

      // Location
      location =
        nextData?.props?.pageProps?.listingData?.listing?.city ||
        nextData?.props?.pageProps?.listing?.city ||
        '';
    } catch {
      // fall through to HTML scraping
    }
  }

  // --- Fallback: HTML scraping ---
  if (!title) {
    title =
      $('h1').first().text().trim() ||
      $('[data-testid="listing-title"]').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      'Unknown Listing';
  }

  if (!nightlyPrice) {
    // Try meta tags and visible price text
    const ogPrice = $('meta[property="og:price:amount"]').attr('content');
    if (ogPrice) {
      nightlyPrice = parseFloat(ogPrice);
    } else {
      const priceText = $('[data-testid*="price"]').first().text() ||
                        $('._tyxjp1').first().text() ||  // Airbnb price class (may change)
                        '';
      const priceMatch = priceText.match(/\$?([\d,]+)/);
      if (priceMatch) {
        nightlyPrice = parseFloat(priceMatch[1].replace(',', ''));
      }
    }
  }

  if (!reviewScore) {
    const ratingText = $('[aria-label*="rating"]').first().attr('aria-label') ||
                       $('[data-testid*="rating"]').first().text();
    const ratingMatch = ratingText?.match(/([\d.]+)/);
    if (ratingMatch) {
      reviewScore = parseFloat(ratingMatch[1]);
    }
  }

  if (!reviewCount) {
    const reviewText = $('[data-testid*="review"]').first().text() ||
                       $('a[href*="reviews"]').first().text();
    const countMatch = reviewText?.match(/([\d,]+)\s*review/i);
    if (countMatch) {
      reviewCount = parseInt(countMatch[1].replace(',', ''), 10);
    }
  }

  if (photoCount === 0) {
    // Count images in photo gallery
    const galleryImgs = $('[data-testid="photo-viewer"] img, [data-testid*="photo"] img').length ||
                         $('picture img').length;
    photoCount = galleryImgs;
    // Also check Open Graph image count as a minimum signal
    if (photoCount === 0 && $('meta[property="og:image"]').length > 0) {
      photoCount = 1;
    }
  }

  if (topAmenities.length === 0) {
    $('[data-testid*="amenity"], [data-section-id*="AMENITIES"] li').each((_, el) => {
      const text = $(el).text().trim();
      if (text && topAmenities.length < 5) {
        topAmenities.push(text);
      }
    });
  }

  if (!location) {
    location = $('meta[property="og:locality"]').attr('content') ||
               $('[data-testid*="location"]').first().text().trim() ||
               '';
  }

  return {
    listingId,
    listingUrl: url,
    title: title || 'Unknown Listing',
    nightlyPrice: nightlyPrice || null,
    reviewCount: reviewCount || null,
    reviewScore: reviewScore || null,
    photoCount: photoCount || 0,
    topAmenities: topAmenities.slice(0, 5),
    bedroomCount: bedroomCount || null,
    location: location || '',
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Build a minimal fallback listing object when scraping fails.
 * @param {string} listingId
 * @param {string} url
 * @returns {import('./types.mjs').CompetitorListing}
 */
function buildFallbackListing(listingId, url) {
  return {
    listingId,
    listingUrl: url,
    title: 'Competitor Listing',
    nightlyPrice: null,
    reviewCount: null,
    reviewScore: null,
    photoCount: 0,
    topAmenities: [],
    bedroomCount: null,
    location: '',
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Rate-limit helper — wait between requests to be polite.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main export: scrape top nearby Airbnb competitors.
 *
 * @param {object} params
 * @param {string} params.location    - City/area string (e.g. "Scottsdale, AZ")
 * @param {number} params.bedrooms    - Owner's bedroom count
 * @param {number} [params.maxResults] - How many competitors (5–10, default 8)
 * @returns {Promise<import('./types.mjs').CompetitorListing[]>}
 */
export async function scrapeNearbyCompetitors({ location, bedrooms, maxResults = 8 }) {
  const limit = Math.min(MAX_COMPETITORS, Math.max(MIN_COMPETITORS, maxResults));

  console.log(`[CompetitorScraper] Searching for ${limit} competitors near "${location}" with ${bedrooms} bedroom(s)`);

  // Step 1: Get search result listing IDs
  const searchUrl = buildSearchUrl(location, bedrooms);
  console.log(`[CompetitorScraper] Search URL: ${searchUrl}`);

  let html;
  try {
    html = await fetchHtml(searchUrl);
  } catch (err) {
    throw new Error(`Failed to fetch Airbnb search results: ${err.message}`);
  }

  const listingRefs = parseSearchResultIds(html);
  console.log(`[CompetitorScraper] Found ${listingRefs.length} candidate listings`);

  if (listingRefs.length === 0) {
    console.warn('[CompetitorScraper] No listings found in search results — returning empty array');
    return [];
  }

  // Step 2: Scrape each listing detail page
  const targetRefs = listingRefs.slice(0, limit);
  const competitors = [];

  for (let i = 0; i < targetRefs.length; i++) {
    const ref = targetRefs[i];
    console.log(`[CompetitorScraper] Scraping listing ${i + 1}/${targetRefs.length}: ${ref.listingId}`);

    const listing = await scrapeListingDetail(ref.listingId, ref.url);
    competitors.push(listing);

    // Polite delay between requests (1–2 seconds)
    if (i < targetRefs.length - 1) {
      await sleep(1000 + Math.random() * 1000);
    }
  }

  console.log(`[CompetitorScraper] Scraped ${competitors.length} competitor listings`);
  return competitors;
}
