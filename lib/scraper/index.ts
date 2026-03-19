import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AirbnbReview {
  text: string;
  rating: number;
  date: string;
  reviewer?: string;
}

export interface AirbnbListingData {
  url: string;
  platform: 'airbnb' | 'vrbo';
  title: string;
  description: string;
  photos: string[];
  photoCount: number;
  amenities: string[];
  rating: number | null;
  reviewCount: number;
  reviews: AirbnbReview[];
  pricePerNight: number | null;
  currency: string;
  propertyType: string;
  location: string;
  hostResponseRate: string | null;
  hostName: string | null;
  maxGuests: number | null;
  bedrooms: number | null;
  beds: number | null;
  baths: number | null;
  listingId: string | null;
  scrapedAt: string;
}

// ─── Supabase client (lazy — only instantiated when env vars present) ─────────

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[scraper] Supabase env vars not set — skipping DB write');
    return null;
  }

  return createClient(url, key);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractListingId(url: string): string | null {
  // https://www.airbnb.com/rooms/12345678
  const roomsMatch = url.match(/airbnb\.com\/rooms\/(\d+)/);
  if (roomsMatch) return roomsMatch[1];

  // https://www.airbnb.com/h/some-slug
  const slugMatch = url.match(/airbnb\.com\/h\/([^/?&#]+)/);
  if (slugMatch) return slugMatch[1];

  return null;
}

function safeInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n);
}

function safeFloat(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Core scraper ─────────────────────────────────────────────────────────────

async function scrapeWithPage(page: Page, url: string): Promise<AirbnbListingData> {
  const listingId = extractListingId(url);
  const scrapedAt = new Date().toISOString();

  // Set a realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  // Navigate with a generous timeout
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 25000,
  });

  // Wait for the main content to appear
  await page.waitForSelector('h1, [data-section-id="TITLE_DEFAULT"]', {
    timeout: 10000,
  }).catch(() => {
    // Non-fatal — we'll try to extract whatever is there
    console.warn('[scraper] Timed out waiting for h1, proceeding anyway');
  });

  // Small buffer for JS hydration
  await new Promise((r) => setTimeout(r, 2000));

  // ── Extract all data in a single page.evaluate call ────────────────────────
  const raw = await page.evaluate(() => {
    // ── Utility ──────────────────────────────────────────────────────────────
    const text = (el: Element | null) => el?.textContent?.trim() ?? null;
    const attr = (el: Element | null, a: string) =>
      el ? (el as HTMLElement).getAttribute(a) : null;

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleEl =
      document.querySelector('[data-section-id="TITLE_DEFAULT"] h1') ||
      document.querySelector('h1') ||
      document.querySelector('[data-plugin-in-point-id="TITLE_DEFAULT"] h1');
    const title = text(titleEl) ?? '';

    // ── Description ───────────────────────────────────────────────────────────
    // Airbnb wraps description in a section with data-section-id="DESCRIPTION_DEFAULT"
    const descSection =
      document.querySelector('[data-section-id="DESCRIPTION_DEFAULT"]') ||
      document.querySelector('[data-plugin-in-point-id="DESCRIPTION_DEFAULT"]');
    let description = '';
    if (descSection) {
      // Get all paragraph-like text nodes
      const spans = descSection.querySelectorAll('span, p');
      const parts: string[] = [];
      spans.forEach((s) => {
        const t = s.textContent?.trim();
        if (t && t.length > 20) parts.push(t);
      });
      description = [...new Set(parts)].join('\n\n');
    }
    if (!description) {
      // Fallback: look for the "About this place" section
      const aboutSection = Array.from(document.querySelectorAll('section')).find((s) =>
        s.textContent?.includes('About this place')
      );
      if (aboutSection) {
        description = aboutSection.textContent?.trim() ?? '';
      }
    }

    // ── Photos ────────────────────────────────────────────────────────────────
    const photoEls = document.querySelectorAll(
      'picture img[src*="muscache"], img[src*="a0.muscache.com"], [data-section-id="HERO_DEFAULT"] img'
    );
    const photos: string[] = [];
    photoEls.forEach((img) => {
      const src = (img as HTMLImageElement).src || attr(img, 'data-src') || '';
      // Filter out tiny icons / avatars
      if (src && src.includes('muscache') && !src.includes('50x50') && !photos.includes(src)) {
        photos.push(src);
      }
    });

    // Also check srcset for higher-res
    const allImgs = document.querySelectorAll('img');
    allImgs.forEach((img) => {
      const srcset = img.srcset || img.getAttribute('data-srcset') || '';
      const src = img.src || '';
      if ((src.includes('muscache') || srcset.includes('muscache')) && !src.includes('50x50')) {
        if (src && !photos.includes(src)) photos.push(src);
      }
    });

    // ── Rating & Review count ─────────────────────────────────────────────────
    let ratingText: string | null = null;
    let reviewCountText: string | null = null;

    // Pattern 1: aria-label="Rated X.XX out of 5 with Y reviews"
    const ratingEl = document.querySelector('[aria-label*="Rated"]');
    if (ratingEl) {
      const label = attr(ratingEl, 'aria-label') ?? '';
      const rMatch = label.match(/Rated\s+([\d.]+)/i);
      const cMatch = label.match(/([\d,]+)\s+review/i);
      if (rMatch) ratingText = rMatch[1];
      if (cMatch) reviewCountText = cMatch[1].replace(/,/g, '');
    }

    // Pattern 2: look for star rating in overview
    if (!ratingText) {
      const overviewSection =
        document.querySelector('[data-section-id="OVERVIEW_DEFAULT"]') ||
        document.querySelector('[data-section-id="REVIEWS_DEFAULT"]');
      if (overviewSection) {
        const spans = overviewSection.querySelectorAll('span');
        spans.forEach((s) => {
          const t = s.textContent?.trim() ?? '';
          if (!ratingText && /^\d\.\d+$/.test(t)) ratingText = t;
          if (!reviewCountText && /^\d+$/.test(t.replace(/,/g, '')) && parseInt(t) > 0) {
            reviewCountText = t;
          }
        });
      }
    }

    // Pattern 3: look for the review summary badge
    if (!ratingText) {
      const allSpans = document.querySelectorAll('span');
      allSpans.forEach((s) => {
        const t = s.textContent?.trim() ?? '';
        if (!ratingText && /^\d\.\d{1,2}$/.test(t) && parseFloat(t) <= 5) {
          ratingText = t;
        }
      });
    }

    // ── Amenities ─────────────────────────────────────────────────────────────
    const amenities: string[] = [];
    const amenitySection =
      document.querySelector('[data-section-id="AMENITIES_DEFAULT"]') ||
      document.querySelector('[data-testid="amenity-row"]')?.closest('section');

    if (amenitySection) {
      amenitySection.querySelectorAll('div[class], li').forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length > 2 && t.length < 80 && !amenities.includes(t)) {
          amenities.push(t);
        }
      });
    }

    // ── Price ─────────────────────────────────────────────────────────────────
    let priceText: string | null = null;
    let currency = 'USD';

    // Look for price per night display
    const pricePatterns = [
      '[data-section-id="BOOK_IT_SIDEBAR"] span',
      '[data-testid="book-it-default"] span',
      'div[data-plugin-in-point-id="BOOK_IT_SIDEBAR"] span',
      'span[class*="price"]',
    ];

    for (const sel of pricePatterns) {
      const els = document.querySelectorAll(sel);
      els.forEach((el) => {
        if (priceText) return;
        const t = el.textContent?.trim() ?? '';
        // Match things like "$123" or "€99" or "£150"
        if (/^[£€$¥₩]\s*\d+/.test(t) || /^\d+\s*(USD|EUR|GBP)/.test(t)) {
          priceText = t;
          if (t.startsWith('€')) currency = 'EUR';
          else if (t.startsWith('£')) currency = 'GBP';
        }
      });
      if (priceText) break;
    }

    // ── Property type / location / guests / rooms ─────────────────────────────
    let propertyType = '';
    let location = '';
    let maxGuests: string | null = null;
    let bedrooms: string | null = null;
    let beds: string | null = null;
    let baths: string | null = null;

    const overviewEl =
      document.querySelector('[data-section-id="OVERVIEW_DEFAULT"]') ||
      document.querySelector('[data-plugin-in-point-id="OVERVIEW_DEFAULT"]');

    if (overviewEl) {
      const allText = overviewEl.textContent ?? '';
      const guestMatch = allText.match(/(\d+)\s+guest/i);
      const bedroomMatch = allText.match(/(\d+)\s+bedroom/i);
      const bedMatch = allText.match(/(\d+)\s+bed(?!room)/i);
      const bathMatch = allText.match(/(\d+(?:\.\d+)?)\s+bath/i);

      if (guestMatch) maxGuests = guestMatch[1];
      if (bedroomMatch) bedrooms = bedroomMatch[1];
      if (bedMatch) beds = bedMatch[1];
      if (bathMatch) baths = bathMatch[1];
    }

    // Property type from heading context
    const subtitleEl =
      document.querySelector('[data-section-id="OVERVIEW_DEFAULT"] h2') ||
      document.querySelector('[data-section-id="TITLE_DEFAULT"] h2') ||
      document.querySelector('[data-section-id="OVERVIEW_DEFAULT"] > div > div > div > span');
    if (subtitleEl) {
      const t = text(subtitleEl) ?? '';
      if (t.includes(' in ')) {
        const parts = t.split(' in ');
        propertyType = parts[0].trim();
        location = parts.slice(1).join(' in ').trim();
      } else {
        propertyType = t;
      }
    }

    // Location fallback from breadcrumbs or title
    if (!location) {
      const breadcrumb = document.querySelector('[aria-label="breadcrumb"], nav ol, nav ul');
      if (breadcrumb) {
        const items = breadcrumb.querySelectorAll('li, a');
        const parts: string[] = [];
        items.forEach((i) => {
          const t = i.textContent?.trim();
          if (t && t !== 'Airbnb' && t !== 'Home') parts.push(t);
        });
        if (parts.length) location = parts.join(', ');
      }
    }

    // ── Host info ─────────────────────────────────────────────────────────────
    let hostName: string | null = null;
    let hostResponseRate: string | null = null;

    const hostSection =
      document.querySelector('[data-section-id="HOST_PROFILE_DEFAULT"]') ||
      document.querySelector('[data-plugin-in-point-id="HOST_OVERVIEW_DEFAULT"]');

    if (hostSection) {
      const nameEl = hostSection.querySelector('h2, h3, [data-testid="host-name"]');
      if (nameEl) {
        const rawName = text(nameEl);
        hostName = rawName?.replace(/^Hosted by\s*/i, '').trim() ?? null;
      }

      const allText = hostSection.textContent ?? '';
      const rrMatch = allText.match(/(\d+)%\s+response rate/i);
      if (rrMatch) hostResponseRate = `${rrMatch[1]}%`;
    }

    // ── Reviews ───────────────────────────────────────────────────────────────
    const reviews: Array<{ text: string; rating: number; date: string; reviewer: string }> = [];
    const reviewEls = document.querySelectorAll(
      '[data-section-id="REVIEWS_DEFAULT"] [data-testid="review-card"], ' +
      '[data-section-id="REVIEWS_DEFAULT"] > div > div > div > div'
    );

    reviewEls.forEach((el) => {
      if (reviews.length >= 20) return;
      const bodyEl = el.querySelector('span[class], p');
      const reviewText = text(bodyEl) ?? text(el) ?? '';
      if (reviewText.length < 10) return;

      const dateEl = el.querySelector('time, [class*="date"], [class*="Date"]');
      const reviewDate = attr(dateEl, 'datetime') ?? text(dateEl) ?? '';

      const reviewerEl = el.querySelector('[class*="name"], [class*="Name"], strong');
      const reviewerName = text(reviewerEl) ?? '';

      reviews.push({
        text: reviewText.slice(0, 1000), // cap length
        rating: 5, // Airbnb doesn't show per-review stars publicly
        date: reviewDate,
        reviewer: reviewerName,
      });
    });

    return {
      title,
      description,
      photos,
      ratingText,
      reviewCountText,
      amenities,
      priceText,
      currency,
      propertyType,
      location,
      maxGuests,
      bedrooms,
      beds,
      baths,
      hostName,
      hostResponseRate,
      reviews,
    };
  });

  // ── Also try to pull structured data from JSON-LD ─────────────────────────
  const jsonLd = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent ?? '');
        if (data['@type'] === 'LodgingBusiness' || data['@type'] === 'Product' || data.name) {
          return data;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  // ── Merge JSON-LD data if available ───────────────────────────────────────
  let title = raw.title;
  let description = raw.description;
  let ratingText = raw.ratingText;
  let reviewCountText = raw.reviewCountText;
  let location = raw.location;

  if (jsonLd) {
    if (!title && jsonLd.name) title = jsonLd.name;
    if (!description && jsonLd.description) description = jsonLd.description;
    if (!ratingText && jsonLd.aggregateRating?.ratingValue) {
      ratingText = String(jsonLd.aggregateRating.ratingValue);
    }
    if (!reviewCountText && jsonLd.aggregateRating?.reviewCount) {
      reviewCountText = String(jsonLd.aggregateRating.reviewCount);
    }
    if (!location && jsonLd.address) {
      const a = jsonLd.address;
      const parts = [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean);
      location = parts.join(', ');
    }
  }

  // ── Build structured output ────────────────────────────────────────────────
  const result: AirbnbListingData = {
    url,
    platform: 'airbnb',
    title: title || 'Untitled Listing',
    description: description || '',
    photos: raw.photos.slice(0, 50), // cap at 50
    photoCount: raw.photos.length,
    amenities: raw.amenities.slice(0, 100),
    rating: safeFloat(ratingText),
    reviewCount: safeInt(reviewCountText) ?? 0,
    reviews: raw.reviews,
    pricePerNight: safeFloat(raw.priceText),
    currency: raw.currency,
    propertyType: raw.propertyType || '',
    location: location || '',
    hostResponseRate: raw.hostResponseRate,
    hostName: raw.hostName,
    maxGuests: safeInt(raw.maxGuests),
    bedrooms: safeInt(raw.bedrooms),
    beds: safeInt(raw.beds),
    baths: safeFloat(raw.baths?.toString()),
    listingId,
    scrapedAt,
  };

  return result;
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function scrapeWithRetry(
  url: string,
  maxRetries = 3
): Promise<AirbnbListingData> {
  let lastError: Error | null = null;
  let browser: Browser | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[scraper] Attempt ${attempt}/${maxRetries} for ${url}`);

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process', // Important for Vercel/serverless
          '--disable-blink-features=AutomationControlled',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      const page = await browser.newPage();

      // Hide automation signals
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // @ts-ignore
        window.chrome = { runtime: {} };
      });

      // Set viewport
      await page.setViewport({ width: 1280, height: 900 });

      const result = await scrapeWithPage(page, url);
      await browser.close();
      browser = null;

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[scraper] Attempt ${attempt} failed:`, lastError.message);

      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[scraper] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Scrape failed after all retries');
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

async function persistToSupabase(
  data: AirbnbListingData,
  propertyId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const record = {
    listing_id: data.listingId,
    url: data.url,
    platform: data.platform,
    title: data.title,
    description: data.description,
    photos: data.photos,
    photo_count: data.photoCount,
    amenities: data.amenities,
    rating: data.rating,
    review_count: data.reviewCount,
    reviews: data.reviews,
    price_per_night: data.pricePerNight,
    currency: data.currency,
    property_type: data.propertyType,
    location: data.location,
    host_name: data.hostName,
    host_response_rate: data.hostResponseRate,
    max_guests: data.maxGuests,
    bedrooms: data.bedrooms,
    beds: data.beds,
    baths: data.baths,
    last_scraped_at: data.scrapedAt,
    raw_data: data,
    ...(propertyId ? { property_id: propertyId } : {}),
  };

  const { error } = await supabase
    .from('listings')
    .upsert(record, {
      onConflict: data.listingId ? 'listing_id' : 'url',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('[scraper] Supabase write error:', error);
    // Non-fatal — scrape still succeeded
  } else {
    console.log('[scraper] Listing saved to Supabase');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scrape an Airbnb listing URL and return structured JSON.
 * Optionally persists to Supabase if env vars are configured.
 *
 * @param url        - Full Airbnb listing URL
 * @param options    - Optional: propertyId to associate with DB record, skipDb to skip persistence
 */
export async function scrapeAirbnbListing(
  url: string,
  options: { propertyId?: string; skipDb?: boolean } = {}
): Promise<AirbnbListingData> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL provided to scrapeAirbnbListing');
  }

  // Normalise URL — strip query params that might vary
  let normalizedUrl = url.trim();
  try {
    const parsed = new URL(normalizedUrl);
    // Keep only the path — strip tracking params
    normalizedUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // If URL parsing fails, use as-is
  }

  const startTime = Date.now();
  const data = await scrapeWithRetry(normalizedUrl, 3);
  const elapsed = Date.now() - startTime;

  console.log(`[scraper] Completed in ${elapsed}ms — title: "${data.title}"`);

  if (elapsed > 25000) {
    console.warn('[scraper] Scrape took over 25s — consider moving to background job');
  }

  if (!options.skipDb) {
    await persistToSupabase(data, options.propertyId);
  }

  return data;
}

export default scrapeAirbnbListing;
