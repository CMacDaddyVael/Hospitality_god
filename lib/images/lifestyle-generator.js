/**
 * VAEL Host — Lifestyle Image Generation Pipeline
 * Issue #214: Property-specific AI images from listing data
 *
 * Generates 3 AI lifestyle images per property using Gemini,
 * uploads to Supabase Storage, and records a deliverable.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Supabase client (service-role so we can write to storage + DB)
// ---------------------------------------------------------------------------
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Gemini client
// ---------------------------------------------------------------------------
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY env var');
  }
  return new GoogleGenerativeAI(apiKey);
}

// ---------------------------------------------------------------------------
// Season detection
// ---------------------------------------------------------------------------

/**
 * Returns the current season based on the current month (Northern Hemisphere).
 * Dec–Feb = winter, Mar–May = spring, Jun–Aug = summer, Sep–Nov = autumn
 *
 * @returns {'winter' | 'spring' | 'summer' | 'autumn'}
 */
export function detectCurrentSeason() {
  const month = new Date().getMonth(); // 0-indexed: Jan=0, Dec=11
  if (month >= 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Build property-type-aware descriptive adjectives for the prompt.
 */
function getPropertyDescriptors(propertyType = '') {
  const type = propertyType.toLowerCase();

  const descriptorMap = {
    cabin: { exterior: 'rustic log cabin', interior: 'cozy cabin living room with exposed wooden beams', ambiance: 'warm cabin retreat' },
    chalet: { exterior: 'alpine chalet', interior: 'ski chalet living room', ambiance: 'mountain chalet atmosphere' },
    beach: { exterior: 'beachfront property', interior: 'bright coastal living room', ambiance: 'breezy beach getaway' },
    cottage: { exterior: 'charming cottage', interior: 'quaint cottage interior', ambiance: 'cozy cottage escape' },
    villa: { exterior: 'luxury villa', interior: 'elegant villa living room', ambiance: 'upscale villa ambiance' },
    condo: { exterior: 'modern condominium', interior: 'contemporary condo living room', ambiance: 'sleek urban retreat' },
    apartment: { exterior: 'stylish apartment building', interior: 'modern apartment living room', ambiance: 'chic city apartment' },
    farmhouse: { exterior: 'charming farmhouse', interior: 'rustic farmhouse living room', ambiance: 'pastoral farmhouse retreat' },
    treehouse: { exterior: 'whimsical treehouse nestled in trees', interior: 'treehouse interior with forest views', ambiance: 'magical treehouse escape' },
    loft: { exterior: 'industrial loft building', interior: 'open-plan loft living space', ambiance: 'artistic loft atmosphere' },
  };

  // Find matching key
  for (const [key, descriptors] of Object.entries(descriptorMap)) {
    if (type.includes(key)) return descriptors;
  }

  // Default: generic vacation rental
  return {
    exterior: 'beautiful vacation rental home',
    interior: 'welcoming vacation rental living room',
    ambiance: 'inviting holiday retreat',
  };
}

/**
 * Get season-specific atmospheric details to inject into prompts.
 */
function getSeasonDetails(season) {
  const seasonMap = {
    winter: {
      lighting: 'warm golden interior lighting against a cold winter exterior',
      atmosphere: 'snow-dusted surroundings, cozy fireplace glow, warm blankets and hot cocoa',
      exterior: 'light snow on the roof, frost on windows, warm lights glowing from inside',
      interior: 'crackling fireplace, plush throws, steaming mugs, soft candlelight',
    },
    spring: {
      lighting: 'soft natural morning light, fresh and airy',
      atmosphere: 'blooming flowers outside, fresh breeze, bright cheerful rooms',
      exterior: 'surrounded by blooming flowers and fresh green foliage, clear blue sky',
      interior: 'fresh flowers in vases, light linen, open windows with sheer curtains',
    },
    summer: {
      lighting: 'bright natural sunlight, golden hour glow',
      atmosphere: 'lush greenery, vibrant colors, outdoor living spaces',
      exterior: 'lush summer greenery, bright sunshine, blue sky with puffy clouds',
      interior: 'bright airy rooms, summery decor, views of outdoor garden or pool',
    },
    autumn: {
      lighting: 'warm amber and golden light, late afternoon sun',
      atmosphere: 'fall foliage, warm earth tones, harvest atmosphere',
      exterior: 'surrounded by vibrant autumn foliage in red, orange, and gold',
      interior: 'warm earth tones, pumpkins and seasonal decor, soft ambient lighting',
    },
  };

  return seasonMap[season] || seasonMap.autumn;
}

/**
 * Build the 3 image prompts for a property.
 *
 * Slot 1: Exterior / Hero shot
 * Slot 2: Interior living space
 * Slot 3: Lifestyle / Ambiance
 *
 * @param {Object} params
 * @param {string} params.propertyType
 * @param {string} params.location
 * @param {string[]} params.amenities
 * @param {string} params.season
 * @returns {Array<{slot: string, prompt: string}>}
 */
export function buildImagePrompts({ propertyType, location, amenities, season }) {
  const descriptors = getPropertyDescriptors(propertyType);
  const seasonDetails = getSeasonDetails(season);

  // Extract standout amenities for prompt enrichment (max 3)
  const amenityHighlights = buildAmenityHighlights(amenities);

  const baseStyle =
    'professional real estate lifestyle photography style, no people, photorealistic, ' +
    'high dynamic range, sharp focus, architecturally composed, magazine quality';

  const locationContext = location
    ? `located in ${location}, `
    : '';

  const prompts = [
    {
      slot: 'exterior_hero',
      label: 'Exterior / Hero',
      prompt: [
        `Lifestyle photo of a ${descriptors.exterior} ${locationContext}`,
        `${seasonDetails.exterior}.`,
        `${seasonDetails.lighting}.`,
        amenityHighlights.exterior ? `Property features ${amenityHighlights.exterior}.` : '',
        `Shot from a slight angle to show depth and character.`,
        baseStyle,
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      slot: 'interior_living',
      label: 'Interior Living Space',
      prompt: [
        `Lifestyle interior photo of a ${descriptors.interior} ${locationContext}`,
        `${seasonDetails.interior}.`,
        `${seasonDetails.lighting}.`,
        amenityHighlights.interior ? `The space has ${amenityHighlights.interior}.` : '',
        `Wide-angle interior shot showing the full living area, tastefully decorated.`,
        baseStyle,
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      slot: 'lifestyle_ambiance',
      label: 'Lifestyle / Ambiance',
      prompt: [
        `Lifestyle ambiance photo capturing the feeling of a ${descriptors.ambiance} ${locationContext}`,
        `${seasonDetails.atmosphere}.`,
        `${seasonDetails.lighting}.`,
        amenityHighlights.lifestyle ? `Highlighted feature: ${amenityHighlights.lifestyle}.` : '',
        `Close-up atmospheric detail shot — fireplace, morning coffee on a deck, books by a window, or a beautifully set dining table.`,
        `Evoke emotion and desire to book. Warm, inviting, aspirational.`,
        baseStyle,
      ]
        .filter(Boolean)
        .join(' '),
    },
  ];

  return prompts;
}

/**
 * Parse amenities list and extract relevant highlights per image slot.
 */
function buildAmenityHighlights(amenities = []) {
  if (!Array.isArray(amenities) || amenities.length === 0) {
    return { exterior: '', interior: '', lifestyle: '' };
  }

  const lower = amenities.map((a) => a.toLowerCase());

  const exteriorFeatures = ['pool', 'hot tub', 'jacuzzi', 'deck', 'patio', 'fire pit', 'garden', 'ocean view', 'mountain view', 'lake view', 'private beach'];
  const interiorFeatures = ['fireplace', 'wood-burning fireplace', 'vaulted ceilings', 'open kitchen', 'gourmet kitchen', 'exposed beams', 'floor-to-ceiling windows', 'loft', 'library'];
  const lifestyleFeatures = ['fireplace', 'hot tub', 'coffee station', 'wine cellar', 'game room', 'theater room', 'sauna', 'yoga studio', 'reading nook'];

  const findMatch = (featureList) =>
    featureList.find((f) => lower.some((a) => a.includes(f))) || '';

  return {
    exterior: findMatch(exteriorFeatures),
    interior: findMatch(interiorFeatures),
    lifestyle: findMatch(lifestyleFeatures),
  };
}

// ---------------------------------------------------------------------------
// Gemini image generation
// ---------------------------------------------------------------------------

/**
 * Call Gemini imagen API to generate a single image.
 * Returns raw image bytes (Buffer) or throws on failure.
 *
 * @param {GoogleGenerativeAI} genAI
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function generateImageWithGemini(genAI, prompt) {
  // Use the Imagen model via the Gemini SDK
  const model = genAI.getGenerativeModel({
    model: 'imagen-3.0-generate-001',
  });

  const result = await model.generateImages({
    prompt,
    number_of_images: 1,
    aspect_ratio: '4:3',
    safety_filter_level: 'block_few',
    person_generation: 'dont_allow', // No people — lifestyle only
  });

  if (
    !result ||
    !result.images ||
    !result.images[0] ||
    !result.images[0].imageBytes
  ) {
    throw new Error('Gemini returned no image data');
  }

  return Buffer.from(result.images[0].imageBytes, 'base64');
}

// ---------------------------------------------------------------------------
// Supabase Storage upload
// ---------------------------------------------------------------------------

/**
 * Upload image buffer to Supabase Storage.
 * Returns the public URL of the uploaded image.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Buffer} imageBuffer
 * @param {string} storagePath - e.g. "listing-images/sub_123/del_456/exterior_hero.jpg"
 * @returns {Promise<string>} public URL
 */
async function uploadImageToStorage(supabase, imageBuffer, storagePath) {
  const { error } = await supabase.storage
    .from('listing-images')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('listing-images')
    .getPublicUrl(storagePath);

  if (!urlData || !urlData.publicUrl) {
    throw new Error(`Failed to get public URL for ${storagePath}`);
  }

  return urlData.publicUrl;
}

// ---------------------------------------------------------------------------
// Deliverable record
// ---------------------------------------------------------------------------

/**
 * Upsert a deliverable record in Supabase.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} params
 * @param {string} params.subscriberId
 * @param {string} params.deliverableId
 * @param {string[]} params.imageUrls
 * @param {'ready' | 'failed'} params.status
 * @param {string | null} params.errorMessage
 * @returns {Promise<void>}
 */
async function upsertDeliverable(supabase, { subscriberId, deliverableId, imageUrls, status, errorMessage }) {
  const payload = {
    id: deliverableId,
    subscriber_id: subscriberId,
    type: 'lifestyle_images',
    status,
    image_urls: imageUrls,
    error_message: errorMessage || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('deliverables')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert deliverable record: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate 3 lifestyle images for a property listing and store them.
 *
 * @param {Object} listingData
 * @param {string} listingData.propertyType   - e.g. "cabin", "beach house", "condo"
 * @param {string} listingData.location       - e.g. "Lake Tahoe, CA"
 * @param {string[]} listingData.amenities    - e.g. ["fireplace", "hot tub", "mountain view"]
 * @param {string} [listingData.season]       - override auto-detection: "winter" | "spring" | "summer" | "autumn"
 * @param {string} listingData.subscriberId   - Supabase subscriber/user ID
 * @param {string} listingData.deliverableId  - Unique ID for this deliverable batch
 *
 * @returns {Promise<string[]>} Array of 3 public image URLs
 */
export async function generateListingImages(listingData) {
  const {
    propertyType = 'vacation rental',
    location = '',
    amenities = [],
    season: seasonOverride,
    subscriberId,
    deliverableId,
  } = listingData;

  if (!subscriberId) throw new Error('subscriberId is required');
  if (!deliverableId) throw new Error('deliverableId is required');

  // Auto-detect season unless overridden
  const season = seasonOverride || detectCurrentSeason();

  console.log(`[lifestyle-generator] Starting image generation`);
  console.log(`  Property: ${propertyType} in ${location || 'unspecified location'}`);
  console.log(`  Season: ${season}`);
  console.log(`  Subscriber: ${subscriberId} / Deliverable: ${deliverableId}`);

  const supabase = getSupabaseClient();
  const genAI = getGeminiClient();

  // Build the 3 prompts
  const imagePrompts = buildImagePrompts({ propertyType, location, amenities, season });

  console.log(`[lifestyle-generator] Built ${imagePrompts.length} prompts`);

  const imageUrls = [];
  const errors = [];

  for (const { slot, label, prompt } of imagePrompts) {
    console.log(`[lifestyle-generator] Generating image: ${label}`);
    console.log(`  Prompt: ${prompt.substring(0, 120)}...`);

    try {
      // 1. Generate image via Gemini
      const imageBuffer = await generateImageWithGemini(genAI, prompt);

      // 2. Upload to Supabase Storage
      const storagePath = `${subscriberId}/${deliverableId}/${slot}.jpg`;
      const publicUrl = await uploadImageToStorage(supabase, imageBuffer, storagePath);

      imageUrls.push(publicUrl);
      console.log(`[lifestyle-generator] ✓ ${label} → ${publicUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[lifestyle-generator] ✗ Failed to generate ${label}: ${message}`);
      errors.push({ slot, label, error: message });
    }
  }

  // Determine overall status
  const allFailed = imageUrls.length === 0;
  const status = allFailed ? 'failed' : 'ready';
  const errorMessage = errors.length > 0
    ? errors.map((e) => `${e.label}: ${e.error}`).join('; ')
    : null;

  // Record the deliverable regardless of success/failure
  try {
    await upsertDeliverable(supabase, {
      subscriberId,
      deliverableId,
      imageUrls,
      status,
      errorMessage,
    });
    console.log(`[lifestyle-generator] Deliverable recorded — status: ${status}`);
  } catch (dbErr) {
    console.error(`[lifestyle-generator] Failed to record deliverable:`, dbErr);
    // Don't swallow — if we can't record the deliverable, surface the error
    throw dbErr;
  }

  if (allFailed) {
    throw new Error(
      `All image generation attempts failed. Errors: ${errorMessage}`
    );
  }

  if (errors.length > 0) {
    console.warn(
      `[lifestyle-generator] ${errors.length} image(s) failed, ${imageUrls.length} succeeded. Partial result returned.`
    );
  }

  console.log(`[lifestyle-generator] Complete — ${imageUrls.length} images ready`);
  return imageUrls;
}
