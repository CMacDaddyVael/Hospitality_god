import * as cheerio from 'cheerio';

export interface AirbnbListingData {
  url: string;
  title: string;
  description: string;
  photoCount: number;
  photoUrls: string[];
  reviewCount: number;
  averageRating: number;
  amenities: string[];
  rawCopy: string;
  pricing: {
    pricePerNight: number | null;
    currency: string;
    visible: boolean;
  };
  reviews: Array<{
    text: string;
    rating: number;
    date: string;
    authorName: string;
    hostResponse: string | null;
  }>;
  location: string;
  propertyType: string;
  hostName: string;
  hostResponseRate: string | null;
  hostResponseTime: string | null;
  instantBook: boolean;
  scrapedAt: string;
  scrapedVia: 'puppeteer' | 'cheerio-fallback';
}

// Selectors and patterns for Airbnb (as of early 2026)
const SELECTORS = {
  title: [
    'h1[elementtiming="LCP-target"]',
    'h1._fecoyn4',
    'h1.hpipapi',
    '[data-section-id="TITLE_DEFAULT"] h1',
    'h1',
  ],
  description: [
    '[data-section-id="DESCRIPTION_DEFAULT"] span',
    '[data-section-id="DESCRIPTION_DEFAULT"]',
    'section[aria-label*="About"] span',
    '._96u5fry span',
    '[data-testid="listing-description"]',
  ],
  amenities: [
    '[data-section-id="AMENITIES_DEFAULT"] div[class*="amenity"]',
    '[data-section-id="AMENITIES_DEFAULT"] li',
    'div[data-amenity-id]',
    '._11jhslp',
    '[data-testid="amenity-row"]',
  ],
  photos: [
    'img[data-original-uri]',
    'picture source[srcset]',
    '[data-testid="photo-viewer-section"] img',
    '.i9t8tce img',
    '[class*="photo"] img',
  ],
  reviews: [
    '[data-section-id="REVIEWS_DEFAULT"]',
    '[data-testid="reviews-container"]',
  ],
  rating: [
    '[data-testid="listing-star-rating"]',
    'span[aria-label*="rating"]',
    '._17p6nbba',
    'span.ru0q88m',
  ],
  price: [
    '[data-testid="price-element"]',
    'span._tyxjp1',
    'div[class*="price"] span',
    'span[class*="price"]',
  ],
  location: [
    '[data-section-id="LOCATION_DEFAULT"] h2',
    '[data-testid="listing-location"]',
    'h2._14i3z6h',
  ],
  propertyType: [
    '[data-testid="listing-type"]',
    '._tqmy57',
    'div[class*="property-type"]',
  ],
  hostName: [
    '[data-testid="host-profile-name"]',
    '._14i3z6h span',
    'div[class*="host"] span',
  ],
};

function extractJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  let data: Record<string, unknown> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}');
      if (parsed['@type'] === 'LodgingBusiness' || parsed['@type'] === 'Product' || parsed.name) {
        data = parsed;
      }
    } catch {
      // ignore malformed JSON
    }
  });

  return data;
}

function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractBootstrapData(html: string): Record<string, unknown> | null {
  // Airbnb sometimes puts data in a bootstrap data script
  const patterns = [
    /window\.__bootstrap_data__\s*=\s*({[\s\S]*?});/,
    /bootstrapData\s*=\s*({[\s\S]*?});/,
    /niobe-data[^>]*>([\s\S]*?)<\/script>/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function deepSearch(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = deepSearch(item, keys);
      if (result !== null && result !== undefined) return result;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const result = deepSearch(value, keys);
      if (result !== null && result !== undefined) return result;
    }
  }

  return null;
}

function extractAllImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images = new Set<string>();

  // From img tags
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original-uri');
    if (src && isListingPhoto(src)) {
      images.add(normalizeImageUrl(src));
    }
  });

  // From picture/source tags
  $('source').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    const srcs = srcset.split(',').map((s) => s.trim().split(' ')[0]);
    for (const src of srcs) {
      if (src && isListingPhoto(src)) {
        images.add(normalizeImageUrl(src));
      }
    }
  });

  // From JSON embedded data
  const jsonMatches = html.matchAll(/"originalUrl"\s*:\s*"([^"]+)"/g);
  for (const m of jsonMatches) {
    if (isListingPhoto(m[1])) images.add(m[1]);
  }

  const pictureMatches = html.matchAll(/"picture"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/g);
  for (const m of pictureMatches) {
    if (isListingPhoto(m[1])) images.add(m[1]);
  }

  // From baseUrl patterns in JS
  const photoUrlPattern = /https:\/\/a0\.muscache\.com\/im\/pictures\/[a-zA-Z0-9\-\/_.]+/g;
  const photoMatches = html.matchAll(photoUrlPattern);
  for (const m of photoMatches) {
    images.add(m[0]);
  }

  return Array.from(images);
}

function isListingPhoto(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('muscache.com') ||
    url.includes('a0.muscache.com') ||
    (url.includes('airbnb.com') && url.includes('/pictures/'))
  );
}

function normalizeImageUrl(url: string): string {
  // Remove query params that specify size to get consistent base URLs
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function extractAmenitiesFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const amenities: string[] = [];

  // Try multiple selectors
  for (const selector of SELECTORS.amenities) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 100) {
        amenities.push(text);
      }
    });
    if (amenities.length > 0) break;
  }

  // Also search in JSON data for amenities
  const amenityPattern = /"title"\s*:\s*"([^"]{3,80})"(?:[^}]*)"available"\s*:\s*true/g;
  const matches = html.matchAll(amenityPattern);
  for (const m of matches) {
    if (!amenities.includes(m[1])) {
      amenities.push(m[1]);
    }
  }

  // Search for amenity names from common patterns
  const sections = html.match(/"amenities"\s*:\s*\[([\s\S]*?)\]/);
  if (sections) {
    const nameMatches = sections[1].matchAll(/"name"\s*:\s*"([^"]+)"/g);
    for (const m of nameMatches) {
      if (!amenities.includes(m[1])) amenities.push(m[1]);
    }
  }

  return [...new Set(amenities)].filter((a) => a.length > 2);
}

function extractReviewsFromHtml(html: string): AirbnbListingData['reviews'] {
  const reviews: AirbnbListingData['reviews'] = [];

  // Try to find review data in JSON blobs
  const reviewPattern = /"comments"\s*:\s*"([^"]{20,})"/g;
  const hostResponsePattern = /"hostResponse"\s*:\s*(?:"([^"]*?)"|null)/g;
  const authorPattern = /"authorName"\s*:\s*"([^"]+)"/g;
  const datePattern = /"createdAt"\s*:\s*"([^"]+)"/g;

  const comments: string[] = [];
  const hostResponses: (string | null)[] = [];
  const authors: string[] = [];
  const dates: string[] = [];

  for (const m of html.matchAll(reviewPattern)) {
    comments.push(m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'));
  }
  for (const m of html.matchAll(hostResponsePattern)) {
    hostResponses.push(m[1] || null);
  }
  for (const m of html.matchAll(authorPattern)) {
    authors.push(m[1]);
  }
  for (const m of html.matchAll(datePattern)) {
    dates.push(m[1]);
  }

  for (let i = 0; i < comments.length; i++) {
    reviews.push({
      text: comments[i],
      rating: 5, // Airbnb doesn't expose individual review ratings in HTML easily
      date: dates[i] || '',
      authorName: authors[i] || 'Guest',
      hostResponse: hostResponses[i] || null,
    });
  }

  return reviews.slice(0, 20); // cap at 20
}

function extractFromNextData(nextData: Record<string, unknown>): Partial<AirbnbListingData> {
  const result: Partial<AirbnbListingData> = {};

  try {
    // Navigate Airbnb's Next.js data structure
    const props = (nextData as any)?.props?.pageProps;
    if (!props) return result;

    // Try to find listing details
    const listing =
      props?.listing ||
      props?.pdpListing ||
      deepSearch(props, ['listing', 'pdpListing', 'listingInfo']);

    if (listing && typeof listing === 'object') {
      const l = listing as Record<string, unknown>;
      result.title = (l.name as string) || (l.title as string) || '';
      result.description =
        (l.description as string) ||
        (deepSearch(l, ['description', 'htmlDescription', 'htmlText']) as string) ||
        '';
      result.averageRating =
        (l.avgRating as number) ||
        (l.starRating as number) ||
        (deepSearch(l, ['avgRating', 'starRating', 'rating']) as number) ||
        0;
      result.reviewCount =
        (l.reviewsCount as number) ||
        (deepSearch(l, ['reviewsCount', 'numberOfReviews']) as number) ||
        0;
      result.hostName = (deepSearch(l, ['hostName', 'name']) as string) || '';
      result.location =
        (l.publicAddress as string) ||
        (deepSearch(l, ['publicAddress', 'city', 'location']) as string) ||
        '';
    }

    // Try sections data (Airbnb Niobe)
    const sections = deepSearch(props, ['sections', 'sbuiData', 'sectionsInfo']);
    if (sections && Array.isArray(sections)) {
      for (const section of sections as unknown[]) {
        if (!section || typeof section !== 'object') continue;
        const s = section as Record<string, unknown>;
        const sectionId = s.sectionId as string;

        if (sectionId === 'TITLE_DEFAULT' || sectionId === 'OVERVIEW_DEFAULT') {
          result.title = result.title || (deepSearch(s, ['title', 'name']) as string) || '';
        }
        if (sectionId === 'DESCRIPTION_DEFAULT') {
          const desc = deepSearch(s, ['htmlDescription', 'description', 'htmlText']);
          if (desc) result.description = (desc as string).replace(/<[^>]+>/g, ' ').trim();
        }
        if (sectionId === 'AMENITIES_DEFAULT') {
          const ams = deepSearch(s, ['amenities', 'seeAllAmenitiesGroups']);
          if (ams && Array.isArray(ams)) {
            const names: string[] = [];
            for (const group of ams as unknown[]) {
              const amenities = deepSearch(group as Record<string, unknown>, ['amenities']);
              if (Array.isArray(amenities)) {
                for (const a of amenities as unknown[]) {
                  const name = deepSearch(a as Record<string, unknown>, ['title', 'name']);
                  if (name) names.push(name as string);
                }
              }
            }
            if (names.length > 0) result.amenities = names;
          }
        }
      }
    }
  } catch {
    // ignore parse errors
  }

  return result;
}

async function scrapeWithCheerio(url: string): Promise<AirbnbListingData> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };

  const response = await fetch(url, { headers, redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch listing`);
  }

  const html = await response.text();
  return parseHtml(html, url, 'cheerio-fallback');
}

function parseHtml(html: string, url: string, via: 'puppeteer' | 'cheerio-fallback'): AirbnbListingData {
  const $ = cheerio.load(html);

  // Extract structured data from page
  const jsonLd = extractJsonLd(html);
  const nextData = extractNextData(html);
  const nextDataExtracted = nextData ? extractFromNextData(nextData) : {};

  // Title
  let title = nextDataExtracted.title || '';
  if (!title) {
    for (const sel of SELECTORS.title) {
      const el = $(sel).first();
      if (el.length) {
        title = el.text().trim();
        break;
      }
    }
  }
  if (!title && jsonLd) {
    title = (jsonLd.name as string) || '';
  }

  // Description
  let description = nextDataExtracted.description || '';
  if (!description) {
    for (const sel of SELECTORS.description) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        if (text.length > 50) {
          description = text;
          break;
        }
      }
    }
  }
  if (!description && jsonLd) {
    description = (jsonLd.description as string) || '';
  }

  // Photos
  const photoUrls = extractAllImages(html);

  // Amenities
  const amenities = nextDataExtracted.amenities || extractAmenitiesFromHtml(html);

  // Rating
  let averageRating = nextDataExtracted.averageRating || 0;
  if (!averageRating) {
    const ratingMatch = html.match(/"starRating"\s*:\s*([\d.]+)/);
    if (ratingMatch) averageRating = parseFloat(ratingMatch[1]);
  }
  if (!averageRating) {
    for (const sel of SELECTORS.rating) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        const num = parseFloat(text);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          averageRating = num;
          break;
        }
      }
    }
  }
  if (!averageRating && jsonLd) {
    const aggregate = jsonLd.aggregateRating as Record<string, unknown>;
    if (aggregate?.ratingValue) {
      averageRating = parseFloat(aggregate.ratingValue as string) || 0;
    }
  }

  // Review count
  let reviewCount = nextDataExtracted.reviewCount || 0;
  if (!reviewCount) {
    const reviewMatch = html.match(/"reviewsCount"\s*:\s*(\d+)/);
    if (reviewMatch) reviewCount = parseInt(reviewMatch[1]);
  }
  if (!reviewCount) {
    const reviewMatch2 = html.match(/"numberOfReviews"\s*:\s*(\d+)/);
    if (reviewMatch2) reviewCount = parseInt(reviewMatch2[1]);
  }
  if (!reviewCount && jsonLd) {
    const aggregate = jsonLd.aggregateRating as Record<string, unknown>;
    if (aggregate?.reviewCount) {
      reviewCount = parseInt(aggregate.reviewCount as string) || 0;
    }
  }

  // Pricing
  let pricePerNight: number | null = null;
  const priceMatch = html.match(/"price"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d.]+)"?/);
  if (priceMatch) pricePerNight = parseFloat(priceMatch[1]);

  if (!pricePerNight) {
    const priceMatch2 = html.match(/\$(\d+)\s*(?:per night|\/\s*night|\s*night)/i);
    if (priceMatch2) pricePerNight = parseInt(priceMatch2[1]);
  }

  // Check currency
  const currencyMatch = html.match(/"currency"\s*:\s*"([A-Z]{3})"/);
  const currency = currencyMatch ? currencyMatch[1] : 'USD';

  // Reviews
  const reviews = extractReviewsFromHtml(html);

  // Location
  let location = nextDataExtracted.location || '';
  if (!location) {
    for (const sel of SELECTORS.location) {
      const el = $(sel).first();
      if (el.length) {
        location = el.text().trim();
        break;
      }
    }
  }
  if (!location) {
    const locMatch = html.match(/"city"\s*:\s*"([^"]+)"/);
    if (locMatch) location = locMatch[1];
  }

  // Property type
  let propertyType = '';
  const typeMatch = html.match(/"listingType"\s*:\s*"([^"]+)"/);
  if (typeMatch) propertyType = typeMatch[1];
  if (!propertyType) {
    const typeMatch2 = html.match(/"roomType"\s*:\s*"([^"]+)"/);
    if (typeMatch2) propertyType = typeMatch2[1];
  }

  // Host info
  let hostName = nextDataExtracted.hostName || '';
  if (!hostName) {
    const hostMatch = html.match(/"hostName"\s*:\s*"([^"]+)"/);
    if (hostMatch) hostName = hostMatch[1];
  }

  // Host response rate
  const responseRateMatch = html.match(/"responseRate"\s*:\s*"([^"]+)"/);
  const hostResponseRate = responseRateMatch ? responseRateMatch[1] : null;

  const responseTimeMatch = html.match(/"responseTime"\s*:\s*"([^"]+)"/);
  const hostResponseTime = responseTimeMatch ? responseTimeMatch[1] : null;

  // Instant book
  const instantBook =
    html.includes('instantbook') ||
    html.includes('instant_book') ||
    html.includes('"instantBookable":true') ||
    html.includes('"instantBook":true');

  // Build raw copy
  const rawCopy = [title, description, amenities.join(', ')].filter(Boolean).join('\n\n');

  return {
    url,
    title,
    description,
    photoCount: photoUrls.length,
    photoUrls,
    reviewCount,
    averageRating,
    amenities,
    rawCopy,
    pricing: {
      pricePerNight,
      currency,
      visible: pricePerNight !== null,
    },
    reviews,
    location,
    propertyType,
    hostName,
    hostResponseRate,
    hostResponseTime,
    instantBook,
    scrapedAt: new Date().toISOString(),
    scrapedVia: via,
  };
}

async function scrapeWithPuppeteer(url: string): Promise<AirbnbListingData> {
  // Dynamically import puppeteer to avoid build errors in environments without it
  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = await import('puppeteer');
  } catch {
    throw new Error('Puppeteer not available');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });

    // Wait for key content to load
    try {
      await page.waitForSelector('h1', { timeout: 10000 });
    } catch {
      // If h1 doesn't appear, continue anyway
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });

    await new Promise((r) => setTimeout(r, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise((r) => setTimeout(r, 1000));

    const html = await page.content();
    return parseHtml(html, url, 'puppeteer');
  } finally {
    await browser.close();
  }
}

export async function scrapeAirbnbListing(url: string): Promise<AirbnbListingData> {
  // Validate URL
  if (!url.includes('airbnb.com')) {
    throw new Error('Invalid Airbnb URL');
  }

  // Try Puppeteer first, fall back to Cheerio
  try {
    return await scrapeWithPuppeteer(url);
  } catch (puppeteerErr) {
    console.warn('Puppeteer scrape failed, falling back to Cheerio:', puppeteerErr);
    return await scrapeWithCheerio(url);
  }
}
