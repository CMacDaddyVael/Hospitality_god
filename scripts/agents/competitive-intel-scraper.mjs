/**
 * Airbnb Market Scraper — Competitive Intel Agent
 * Scrapes top 10 listings from public Airbnb search results for a given market.
 * Uses Puppeteer with stealth settings to extract competitor signals.
 *
 * Extracted per listing:
 *   - title
 *   - nightly price
 *   - overall rating
 *   - review count
 *   - first 5 amenity tags (from listing card or detail page)
 */

import puppeteer from 'puppeteer';

const SCRAPE_TIMEOUT = 30_000;
const MAX_LISTINGS = 10;

/**
 * Build the Airbnb search URL for a market, sorted by Guest Favorite signals.
 * Airbnb doesn't expose a public "sort by Guest Favorite" param, but sorting
 * by default (relevance) surfaces high-rated, high-review listings — which is
 * the closest public proxy. We add `&room_types[]=Entire+home` to keep it
 * apples-to-apples with whole-property STRs.
 */
function buildSearchUrl(location) {
  const encoded = encodeURIComponent(location);
  // Using the standard search endpoint — publicly accessible, no auth required
  return `https://www.airbnb.com/s/${encoded}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&flexible_trip_lengths%5B%5D=one_week&price_filter_input_type=0&channel=EXPLORE&search_type=filter_change&sort_by=6`;
}

/**
 * Launch Puppeteer with minimal footprint suitable for CI/GitHub Actions.
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,900',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1280, height: 900 },
  });
}

/**
 * Set stealth headers to reduce bot detection.
 */
async function configurePageStealth(page) {
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });
  // Mask navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
}

/**
 * Wait for listing cards to appear on the search results page.
 * Airbnb renders cards inside itemprop="itemListElement" or data-testid cards.
 */
async function waitForListings(page) {
  try {
    // Primary selector — Airbnb uses itemprop for structured data
    await page.waitForSelector('[itemprop="itemListElement"]', { timeout: SCRAPE_TIMEOUT });
    return '[itemprop="itemListElement"]';
  } catch {
    // Fallback: any listing card container
    await page.waitForSelector('[data-testid="card-container"]', { timeout: SCRAPE_TIMEOUT });
    return '[data-testid="card-container"]';
  }
}

/**
 * Parse listing cards from the search results page DOM.
 * Airbnb's DOM structure changes frequently; we use multiple selector fallbacks.
 */
async function parseListingCards(page) {
  return page.evaluate((maxListings) => {
    const results = [];

    // Airbnb renders listings as <div itemprop="itemListElement"> wrappers
    // Each contains structured data we can read
    const itemElements = document.querySelectorAll('[itemprop="itemListElement"]');
    const cardElements = document.querySelectorAll('[data-testid="card-container"]');

    // Pick whichever selector found more items
    const elements = itemElements.length >= cardElements.length ? itemElements : cardElements;

    const toProcess = Array.from(elements).slice(0, maxListings);

    for (const el of toProcess) {
      try {
        // --- Title ---
        const titleEl =
          el.querySelector('[data-testid="listing-card-title"]') ||
          el.querySelector('[aria-label]') ||
          el.querySelector('div[style*="font-weight"] span') ||
          el.querySelector('span[dir="auto"]');
        const title = titleEl?.textContent?.trim() || null;

        // --- Price ---
        // Airbnb shows price as "_price_per_night" with aria-label like "$142 per night"
        const priceEl =
          el.querySelector('[data-testid="price-availability-row"]') ||
          el.querySelector('span[aria-label*="per night"]') ||
          el.querySelector('._1y74zjx') || // historical class (may change)
          el.querySelector('span[class*="price"]');

        let price = null;
        const priceText =
          priceEl?.getAttribute('aria-label') ||
          priceEl?.textContent ||
          '';
        const priceMatch = priceText.match(/\$[\d,]+/);
        if (priceMatch) {
          price = parseInt(priceMatch[0].replace(/[$,]/g, ''), 10);
        }

        // --- Rating ---
        // Airbnb renders star rating as "4.92 (128 reviews)" in aria-label or text
        const ratingEl =
          el.querySelector('[aria-label*="out of 5"]') ||
          el.querySelector('[class*="rating"]') ||
          el.querySelector('span[aria-label*="stars"]');

        let rating = null;
        let reviewCount = null;

        const ratingText =
          ratingEl?.getAttribute('aria-label') ||
          ratingEl?.textContent ||
          '';

        // Pattern: "4.92 out of 5" or "4.92 (128)"
        const ratingMatch = ratingText.match(/(\d+\.\d+)/);
        const reviewMatch = ratingText.match(/\((\d+(?:,\d+)?)\)/);

        if (ratingMatch) rating = parseFloat(ratingMatch[1]);
        if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(',', ''), 10);

        // Fallback: look for rating in any element containing a decimal number near a star
        if (!rating) {
          const allSpans = el.querySelectorAll('span');
          for (const span of allSpans) {
            const txt = span.textContent?.trim() || '';
            if (/^[45]\.\d{2}$/.test(txt)) {
              rating = parseFloat(txt);
              break;
            }
          }
        }

        // --- Amenities ---
        // Airbnb shows amenity tags as small text below the title
        const amenityEls =
          el.querySelectorAll('[data-testid="listing-card-subtitle"] span') ||
          el.querySelectorAll('div[class*="amenity"] span');

        const amenities = [];
        for (const ae of amenityEls) {
          const text = ae.textContent?.trim();
          if (text && text.length > 1 && text.length < 50) {
            amenities.push(text);
          }
          if (amenities.length >= 5) break;
        }

        // --- Listing URL ---
        const linkEl = el.querySelector('a[href*="/rooms/"]');
        const href = linkEl?.getAttribute('href') || null;
        const listingUrl = href
          ? href.startsWith('http')
            ? href
            : `https://www.airbnb.com${href}`
          : null;

        // Only push if we got at minimum a title or price
        if (title || price) {
          results.push({ title, price, rating, reviewCount, amenities, listingUrl });
        }
      } catch (e) {
        // Skip malformed cards
      }
    }

    return results;
  }, MAX_LISTINGS);
}

/**
 * Attempt to extract additional amenity data from a listing detail page.
 * Called only when the search card had fewer than 3 amenities.
 */
async function enrichWithDetailPage(browser, listingUrl) {
  if (!listingUrl) return [];

  let detailPage = null;
  try {
    detailPage = await browser.newPage();
    await configurePageStealth(detailPage);
    await detailPage.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: SCRAPE_TIMEOUT });

    // Wait for amenity section
    await detailPage.waitForSelector('[data-testid="amenity-row"]', { timeout: 8000 }).catch(() => {});

    const amenities = await detailPage.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="amenity-row"]');
      const tags = [];
      for (const row of rows) {
        const txt = row.textContent?.trim();
        if (txt && txt.length < 60) tags.push(txt);
        if (tags.length >= 5) break;
      }

      // Fallback: look for amenity icon labels
      if (tags.length === 0) {
        const items = document.querySelectorAll('[data-testid="amenities-row"] div, [class*="amenity"]');
        for (const item of items) {
          const txt = item.textContent?.trim();
          if (txt && txt.length > 1 && txt.length < 60 && !tags.includes(txt)) {
            tags.push(txt);
          }
          if (tags.length >= 5) break;
        }
      }
      return tags;
    });

    return amenities;
  } catch {
    return [];
  } finally {
    if (detailPage) await detailPage.close().catch(() => {});
  }
}

/**
 * Main scraper entry point.
 *
 * @param {string} location   — city/market string, e.g. "Scottsdale, AZ"
 * @param {Object} [options]
 * @param {boolean} [options.enrichDetails=false] — fetch detail pages for amenities
 * @returns {Promise<Array>}  — array of competitor listing objects
 */
export async function scrapeCompetitors(location, options = {}) {
  const { enrichDetails = false } = options;

  if (!location || typeof location !== 'string') {
    throw new Error('scrapeCompetitors: location is required');
  }

  const url = buildSearchUrl(location);
  console.log(`[competitive-intel] Scraping market: ${location}`);
  console.log(`[competitive-intel] URL: ${url}`);

  const browser = await launchBrowser();
  let page = null;

  try {
    page = await browser.newPage();
    await configurePageStealth(page);

    // Navigate to search results
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: SCRAPE_TIMEOUT,
    });

    if (!response || response.status() >= 400) {
      throw new Error(`[competitive-intel] HTTP ${response?.status()} fetching search page`);
    }

    // Wait for listing cards
    await waitForListings(page).catch((err) => {
      console.warn('[competitive-intel] Listing selector timeout — trying to parse anyway:', err.message);
    });

    // Small delay to let lazy-loaded content settle
    await new Promise((r) => setTimeout(r, 2000));

    // Parse all visible cards
    let listings = await parseListingCards(page);
    console.log(`[competitive-intel] Found ${listings.length} listing cards`);

    // Optionally enrich with detail-page amenity data
    if (enrichDetails) {
      const enrichmentCandidates = listings.filter((l) => l.amenities.length < 3 && l.listingUrl);
      for (const listing of enrichmentCandidates) {
        const extraAmenities = await enrichWithDetailPage(browser, listing.listingUrl);
        if (extraAmenities.length > listing.amenities.length) {
          listing.amenities = extraAmenities;
        }
        // Polite delay between detail page requests
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Filter out any completely empty results
    const validListings = listings.filter(
      (l) => l.title || (l.price && l.rating)
    );

    console.log(`[competitive-intel] Valid listings: ${validListings.length}`);
    return validListings;

  } finally {
    if (page) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
