/**
 * VAEL Host — Listing Photo Extraction Module
 * Issue #222: Scrape and store property images for the image generation pipeline
 *
 * Accepts a listing URL and Supabase client instance.
 * Extracts photos via Puppeteer, uploads to Supabase Storage,
 * and writes metadata to the `listing_photos` table.
 *
 * This module is ADDITIVE — it does not modify any existing scraper files.
 */

import puppeteer from 'puppeteer'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'listing-photos'

/** Minimum photo count we aim for (graceful if fewer available) */
const TARGET_PHOTO_MIN = 5

/** How long to wait for the Airbnb photo carousel to hydrate */
const CAROUSEL_WAIT_MS = 4000

/** Max concurrent downloads to avoid hammering the CDN */
const DOWNLOAD_CONCURRENCY = 3

/** Request timeout for image downloads (ms) */
const DOWNLOAD_TIMEOUT_MS = 15_000

/**
 * Airbnb CDN URL patterns and their full-resolution counterpart format.
 *
 * Airbnb serves images from a few CDN origins:
 *   https://a0.muscache.com/im/pictures/<id>.jpg?aki_policy=<policy>
 *
 * The `aki_policy` query param controls resolution:
 *   - x_large     → typically 1200×900
 *   - large       → typically 800×600
 *   - medium, small, thumb — progressively smaller
 *
 * We always request `x_large` for the pipeline.
 */
const AIRBNB_CDN_ORIGINS = [
  'a0.muscache.com',
  'a1.muscache.com',
  'a2.muscache.com',
]

/**
 * Heuristic room-type labels derived from Airbnb's own alt-text / aria-label
 * patterns. We attempt to classify each photo; falls back to `null`.
 */
const ROOM_TYPE_KEYWORDS = {
  bedroom: ['bedroom', 'bed room', 'master bed', 'guest bed', 'sleeping'],
  bathroom: ['bathroom', 'bath room', 'bath', 'shower', 'toilet', 'washroom'],
  kitchen: ['kitchen', 'kitchenette', 'cooking', 'stove', 'refrigerator'],
  living_room: ['living room', 'lounge', 'sitting room', 'sofa', 'couch'],
  dining_room: ['dining', 'dining room', 'dinner table'],
  outdoor: ['outdoor', 'outside', 'backyard', 'patio', 'deck', 'pool', 'garden', 'yard', 'terrace', 'balcony', 'porch'],
  view: ['view', 'scenery', 'mountain', 'ocean', 'lake', 'sunset', 'sunrise'],
  entrance: ['entrance', 'entryway', 'front door', 'hallway', 'foyer'],
  workspace: ['workspace', 'desk', 'office', 'work area'],
  garage: ['garage', 'parking', 'carport'],
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Derive a stable listing ID from the URL.
 * For Airbnb: rooms/<id> or h/<slug>
 * Falls back to a short hash of the full URL.
 */
function extractListingId(url) {
  try {
    const parsed = new URL(url)

    // https://www.airbnb.com/rooms/12345678
    const roomsMatch = parsed.pathname.match(/\/rooms\/(\d+)/)
    if (roomsMatch) return `airbnb_${roomsMatch[1]}`

    // https://www.airbnb.com/h/some-slug
    const hMatch = parsed.pathname.match(/\/h\/([^/?#]+)/)
    if (hMatch) return `airbnb_${hMatch[1]}`

    // Vrbo: https://www.vrbo.com/1234567
    const vrboMatch = parsed.pathname.match(/\/(\d+)/)
    if (vrboMatch && parsed.hostname.includes('vrbo.com')) return `vrbo_${vrboMatch[1]}`
  } catch {
    // fall through
  }

  // Fallback: stable short hash
  return `listing_${createHash('sha256').update(url).digest('hex').slice(0, 12)}`
}

/**
 * Normalize an Airbnb CDN image URL to always request x_large resolution.
 * Strips thumbnail-specific policies and enforces the highest quality variant.
 */
function normalizeAirbnbImageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)

    const isAirbnbCdn = AIRBNB_CDN_ORIGINS.some((origin) => u.hostname === origin)
    if (!isAirbnbCdn) return rawUrl

    // Force x_large policy
    u.searchParams.set('aki_policy', 'x_large')

    // Remove Airbnb's internal cache-busting params that sometimes appear
    u.searchParams.delete('_nc_sid')
    u.searchParams.delete('_nc_ohc')
    u.searchParams.delete('_nc_oc')
    u.searchParams.delete('_nc_ht')
    u.searchParams.delete('edm')

    return u.toString()
  } catch {
    return rawUrl
  }
}

/**
 * Attempt to infer a room type label from alt text or aria-label strings.
 * Returns a key from ROOM_TYPE_KEYWORDS or null.
 */
function inferRoomType(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [roomType, keywords] of Object.entries(ROOM_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return roomType
    }
  }
  return null
}

/**
 * Build a safe storage filename from a URL and display order index.
 */
function buildStorageFilename(imageUrl, index) {
  try {
    const u = new URL(imageUrl)
    // Extract the last path segment (e.g. "pictures/123456789.jpg")
    const segments = u.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] || 'photo'
    // Strip any extension and re-attach .jpg for consistency
    const base = lastSegment.replace(/\.[^.]+$/, '')
    return `${String(index).padStart(3, '0')}_${base}.jpg`
  } catch {
    return `${String(index).padStart(3, '0')}_photo_${createHash('md5').update(imageUrl).digest('hex').slice(0, 8)}.jpg`
  }
}

/**
 * Download an image URL and return the raw buffer.
 * Uses native fetch with a timeout AbortController.
 */
async function downloadImage(imageUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://www.airbnb.com/',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${imageUrl}`)
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, contentType }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run an array of async tasks with limited concurrency.
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = []
  const queue = [...tasks]

  async function runNext() {
    if (queue.length === 0) return
    const task = queue.shift()
    const result = await task()
    results.push(result)
    await runNext()
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () =>
    runNext()
  )
  await Promise.all(workers)
  return results
}

// ---------------------------------------------------------------------------
// Puppeteer photo scraping
// ---------------------------------------------------------------------------

/**
 * Launch Puppeteer and extract all listing photo URLs from an Airbnb listing page.
 * Handles the lazy-loaded image carousel by scrolling and waiting for network idle.
 *
 * Returns an array of objects: { url: string, altText: string | null }
 */
async function scrapePhotoUrls(listingUrl) {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,900',
      ],
    })

    const page = await browser.newPage()

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1280, height: 900 })
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )

    // Block unnecessary resources to speed up load
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      if (['font', 'stylesheet', 'media'].includes(type)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    console.log(`[listing-photos] Navigating to ${listingUrl}`)
    await page.goto(listingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })

    // Wait for images to begin rendering
    await new Promise((resolve) => setTimeout(resolve, CAROUSEL_WAIT_MS))

    // Scroll down a bit to trigger lazy-load of carousel images
    await page.evaluate(() => {
      window.scrollBy(0, 600)
    })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      window.scrollBy(0, -600)
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Click the "Show all photos" button if present (opens the photo grid)
    try {
      // Airbnb renders a "Show all photos" button at the bottom of the hero grid
      const showAllSelector = 'button[data-testid="pdp-show-all-photos-button"]'
      const showAllBtn = await page.$(showAllSelector)
      if (showAllBtn) {
        await showAllBtn.click()
        await new Promise((resolve) => setTimeout(resolve, 2500))
        console.log('[listing-photos] Clicked "Show all photos" — photo modal open')
      } else {
        // Fallback: look for any button containing "show all photos" text
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const target = buttons.find((b) =>
            b.textContent.toLowerCase().includes('show all photos')
          )
          if (target) target.click()
        })
        await new Promise((resolve) => setTimeout(resolve, 2500))
      }
    } catch (err) {
      console.warn('[listing-photos] Could not click show-all-photos:', err.message)
    }

    // Extract all image URLs from the page
    const photos = await page.evaluate((cdnOrigins) => {
      const seen = new Set()
      const results = []

      // Strategy 1: all <img> tags with srcset or src pointing to Airbnb CDN
      document.querySelectorAll('img').forEach((img) => {
        const sources = []

        // Prefer srcset (highest resolution variant)
        if (img.srcset) {
          // srcset format: "url 1x, url 2x" or "url 600w, url 1200w"
          const srcsetParts = img.srcset.split(',').map((s) => s.trim().split(/\s+/)[0])
          sources.push(...srcsetParts)
        }

        if (img.src) sources.push(img.src)
        if (img.dataset && img.dataset.src) sources.push(img.dataset.src)

        for (const src of sources) {
          if (!src || src.startsWith('data:')) continue
          try {
            const u = new URL(src)
            if (cdnOrigins.some((origin) => u.hostname === origin)) {
              // Filter out tiny icons / thumbnails (< 200px implied by URL patterns)
              if (u.pathname.includes('/pictures/') || u.pathname.includes('/im/')) {
                if (!seen.has(u.pathname)) {
                  seen.add(u.pathname)
                  results.push({
                    url: src,
                    altText: img.alt || img.getAttribute('aria-label') || null,
                  })
                }
              }
            }
          } catch {
            // Invalid URL — skip
          }
        }
      })

      // Strategy 2: picture > source elements (Airbnb uses <picture> for responsive images)
      document.querySelectorAll('picture source').forEach((source) => {
        const srcset = source.srcset || ''
        const parts = srcset.split(',').map((s) => s.trim().split(/\s+/)[0])
        for (const src of parts) {
          if (!src) continue
          try {
            const u = new URL(src)
            if (cdnOrigins.some((origin) => u.hostname === origin)) {
              if (u.pathname.includes('/pictures/') || u.pathname.includes('/im/')) {
                if (!seen.has(u.pathname)) {
                  seen.add(u.pathname)
                  // Try to get alt text from sibling img
                  const parentPicture = source.closest('picture')
                  const siblingImg = parentPicture ? parentPicture.querySelector('img') : null
                  results.push({
                    url: src,
                    altText: siblingImg
                      ? siblingImg.alt || siblingImg.getAttribute('aria-label') || null
                      : null,
                  })
                }
              }
            }
          } catch {
            // skip
          }
        }
      })

      // Strategy 3: scan inline JSON-LD / next data for image arrays
      const nextDataEl = document.getElementById('__NEXT_DATA__')
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent || '{}')
          const jsonStr = JSON.stringify(nextData)
          // Match all muscache.com URLs in the JSON blob
          const urlPattern = /https:\/\/a\d\.muscache\.com\/im\/pictures\/[^"\\]+/g
          const matches = jsonStr.match(urlPattern) || []
          for (const match of matches) {
            try {
              const u = new URL(match)
              if (!seen.has(u.pathname)) {
                seen.add(u.pathname)
                results.push({ url: match, altText: null })
              }
            } catch {
              // skip
            }
          }
        } catch {
          // JSON parse failure — ignore
        }
      }

      return results
    }, AIRBNB_CDN_ORIGINS)

    console.log(`[listing-photos] Raw photo candidates found: ${photos.length}`)
    return photos
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase upload helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the Supabase Storage bucket exists (idempotent).
 * The bucket should be pre-created in production, but this guards CI/test runs.
 */
async function ensureBucketExists(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    console.warn('[listing-photos] Could not list buckets:', error.message)
    return
  }
  const exists = (buckets || []).some((b) => b.name === STORAGE_BUCKET)
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB per image
    })
    if (createErr && !createErr.message.includes('already exists')) {
      console.warn('[listing-photos] Could not create bucket:', createErr.message)
    } else {
      console.log(`[listing-photos] Created storage bucket: ${STORAGE_BUCKET}`)
    }
  }
}

/**
 * Upload a single image buffer to Supabase Storage.
 * Returns the storage path on success, or null on failure.
 */
async function uploadToStorage(supabase, listingId, filename, buffer, contentType) {
  const storagePath = `${listingId}/${filename}`

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: contentType || 'image/jpeg',
      upsert: true, // Idempotent — re-running won't fail
    })

  if (error) {
    console.error(`[listing-photos] Storage upload failed for ${storagePath}:`, error.message)
    return null
  }

  return storagePath
}

/**
 * Write a single row to the `listing_photos` table.
 * On conflict (same listing_id + storage_path) we upsert to stay idempotent.
 */
async function upsertPhotoRow(supabase, row) {
  const { error } = await supabase.from('listing_photos').upsert(row, {
    onConflict: 'listing_id,storage_path',
  })

  if (error) {
    console.error('[listing-photos] DB upsert failed:', error.message, row)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Extract, download, and store all listing photos for a given URL.
 *
 * @param {string} listingUrl - Public Airbnb or Vrbo listing URL
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Initialized Supabase client
 * @param {object} [options]
 * @param {string} [options.listingId] - Override the auto-derived listing ID
 * @param {number} [options.maxPhotos] - Cap the number of photos processed (default: unlimited)
 *
 * @returns {Promise<{
 *   listingId: string,
 *   photosExtracted: number,
 *   photosStored: number,
 *   rows: Array<object>,
 *   errors: string[]
 * }>}
 */
export async function extractListingPhotos(listingUrl, supabase, options = {}) {
  const errors = []
  const storedRows = []

  // 1. Derive listing ID
  const listingId = options.listingId || extractListingId(listingUrl)
  console.log(`[listing-photos] Starting extraction — listing: ${listingId}`)

  // 2. Ensure storage bucket is ready
  await ensureBucketExists(supabase)

  // 3. Scrape photo URLs via Puppeteer
  let rawPhotos = []
  try {
    rawPhotos = await scrapePhotoUrls(listingUrl)
  } catch (err) {
    const msg = `Puppeteer scrape failed: ${err.message}`
    console.error(`[listing-photos] ${msg}`)
    errors.push(msg)
    return { listingId, photosExtracted: 0, photosStored: 0, rows: [], errors }
  }

  if (rawPhotos.length === 0) {
    const msg = 'No photos found on listing page'
    console.warn(`[listing-photos] ${msg}`)
    errors.push(msg)
    return { listingId, photosExtracted: 0, photosStored: 0, rows: [], errors }
  }

  // Log a soft warning when fewer than TARGET_PHOTO_MIN found — don't throw
  if (rawPhotos.length < TARGET_PHOTO_MIN) {
    const msg = `Only ${rawPhotos.length} photos found (target minimum is ${TARGET_PHOTO_MIN}) — processing all available`
    console.warn(`[listing-photos] ${msg}`)
    errors.push(msg) // Non-fatal — recorded in errors array as informational
  }

  // 4. Normalize URLs to full resolution & deduplicate
  const normalizedPhotos = rawPhotos
    .map((p, idx) => ({
      originalUrl: p.url,
      normalizedUrl: normalizeAirbnbImageUrl(p.url),
      altText: p.altText,
      displayOrder: idx,
    }))
    // Apply optional cap
    .slice(0, options.maxPhotos ?? Infinity)

  console.log(`[listing-photos] Processing ${normalizedPhotos.length} normalized photos`)

  // 5. Download & upload with bounded concurrency
  const extractedAt = new Date().toISOString()

  const uploadTasks = normalizedPhotos.map((photo) => async () => {
    const { displayOrder, normalizedUrl, originalUrl, altText } = photo
    const filename = buildStorageFilename(normalizedUrl, displayOrder)

    // 5a. Download
    let downloadResult
    try {
      downloadResult = await downloadImage(normalizedUrl)
    } catch (err) {
      const msg = `Download failed for order=${displayOrder} (${normalizedUrl}): ${err.message}`
      console.error(`[listing-photos] ${msg}`)
      errors.push(msg)
      return null
    }

    const { buffer, contentType } = downloadResult

    // 5b. Upload to Supabase Storage
    const storagePath = await uploadToStorage(
      supabase,
      listingId,
      filename,
      buffer,
      contentType
    )
    if (!storagePath) {
      errors.push(`Storage upload failed for order=${displayOrder}`)
      return null
    }

    // 5c. Build DB row
    const row = {
      listing_id: listingId,
      storage_path: storagePath,
      original_url: originalUrl,
      display_order: displayOrder,
      extracted_at: extractedAt,
      // Optional enrichment fields (nullable — schema allows null)
      room_type: inferRoomType(altText),
    }

    // 5d. Write to listing_photos table
    const saved = await upsertPhotoRow(supabase, row)
    if (!saved) {
      errors.push(`DB write failed for order=${displayOrder}`)
      return null
    }

    console.log(`[listing-photos] ✓ Stored photo ${displayOrder}: ${storagePath}`)
    return row
  })

  const results = await runWithConcurrency(uploadTasks, DOWNLOAD_CONCURRENCY)
  const successfulRows = results.filter(Boolean)
  storedRows.push(...successfulRows)

  console.log(
    `[listing-photos] Extraction complete — ${successfulRows.length}/${normalizedPhotos.length} photos stored`
  )

  return {
    listingId,
    photosExtracted: normalizedPhotos.length,
    photosStored: successfulRows.length,
    rows: storedRows,
    errors,
  }
}

/**
 * Convenience wrapper: extract photos and return a simple summary object.
 * Suitable for calling from API routes or queue workers.
 *
 * @param {string} listingUrl
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ success: boolean, listingId: string, photosStored: number, errors: string[] }>}
 */
export async function extractAndStorePhotos(listingUrl, supabase) {
  try {
    const result = await extractListingPhotos(listingUrl, supabase)
    return {
      success: result.photosStored > 0,
      listingId: result.listingId,
      photosStored: result.photosStored,
      photosExtracted: result.photosExtracted,
      errors: result.errors,
    }
  } catch (err) {
    console.error('[listing-photos] Unexpected error in extractAndStorePhotos:', err)
    return {
      success: false,
      listingId: null,
      photosStored: 0,
      photosExtracted: 0,
      errors: [err.message],
    }
  }
}
