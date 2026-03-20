import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListingScrapeResult {
  title?: string
  propertyType?: string
  location?: string
  amenities?: string[]
  description?: string
  rating?: number
  reviewCount?: number
  pricePerNight?: number
  platform?: string
}

export interface ImageGenerationResult {
  url: string
  storageKey: string
  promptUsed: string
  costUsd: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'imagen-3.0-generate-001'
// Imagen 3 pricing: ~$0.04 per image as of 2026
const COST_PER_IMAGE_USD = 0.04

const SEASON_MAP: Record<number, string> = {
  0: 'winter', 1: 'winter', 2: 'spring',
  3: 'spring', 4: 'spring', 5: 'summer',
  6: 'summer', 7: 'summer', 8: 'autumn',
  9: 'autumn', 10: 'autumn', 11: 'winter',
}

function getCurrentSeason(): string {
  return SEASON_MAP[new Date().getMonth()] ?? 'summer'
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Dynamically constructs an image prompt from property context.
 * Season, location, and property type all influence the visual direction.
 */
export function buildImagePrompt(
  propertyContext: ListingScrapeResult,
  postType: 'interior' | 'exterior' | 'lifestyle' = 'lifestyle'
): string {
  const season = getCurrentSeason()
  const location = propertyContext.location ?? 'a scenic destination'
  const propType = propertyContext.propertyType ?? 'vacation rental'

  // Extract the most evocative amenities for the scene
  const amenities = propertyContext.amenities ?? []
  const scenicAmenities = amenities
    .filter((a) =>
      /pool|hot tub|fireplace|ocean|mountain|view|deck|patio|rooftop|cabin|lake|beach/i.test(a)
    )
    .slice(0, 2)

  const amenityDetail =
    scenicAmenities.length > 0
      ? `featuring ${scenicAmenities.join(' and ').toLowerCase()}`
      : ''

  const sceneDirective =
    postType === 'interior'
      ? 'warm interior shot, cozy atmosphere, soft natural light streaming through windows'
      : postType === 'exterior'
      ? 'beautiful exterior shot, architecture and surroundings in harmony with nature'
      : `inviting ${season} lifestyle scene`

  const prompt = [
    `Aspirational travel photography of a ${propType} in ${location}`,
    amenityDetail,
    `during ${season}.`,
    sceneDirective + '.',
    'Warm golden hour lighting, cinematic depth of field.',
    'No people, no text, no watermarks.',
    'Ultra-high quality, professional real estate photography style.',
    'Instagram-worthy composition, colour-graded for warmth and desirability.',
  ]
    .filter(Boolean)
    .join(' ')

  return prompt
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient(url, key)
}

async function uploadImageToStorage(
  imageBytes: Uint8Array,
  propertyId: string,
  mimeType: string = 'image/png'
): Promise<{ url: string; storageKey: string }> {
  const supabase = getSupabaseClient()

  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const timestamp = Date.now()
  const storageKey = `lifestyle/${propertyId}/${timestamp}.${ext}`

  const { error } = await supabase.storage
    .from('vael-images')
    .upload(storageKey, imageBytes, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('vael-images').getPublicUrl(storageKey)

  return { url: publicUrl, storageKey }
}

// ─── Cost Logging ─────────────────────────────────────────────────────────────

async function logGenerationCost(params: {
  propertyId: string
  model: string
  costUsd: number
  prompt: string
  storageKey: string
  success: boolean
  errorMessage?: string
}): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production'

  if (isDev) {
    console.log(
      `[VAEL cost] model=${params.model} cost=$${params.costUsd.toFixed(4)} property=${params.propertyId} success=${params.success}`
    )
    return
  }

  // In production, write to generation_costs table
  try {
    const supabase = getSupabaseClient()
    await supabase.from('generation_costs').insert({
      property_id: params.propertyId,
      model: params.model,
      cost_usd: params.costUsd,
      prompt_preview: params.prompt.slice(0, 500),
      storage_key: params.storageKey,
      success: params.success,
      error_message: params.errorMessage ?? null,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Never let cost logging crash the worker
    console.error('[VAEL cost logging failed]', err)
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generates one AI lifestyle image via Gemini Imagen and uploads it to
 * Supabase Storage. Returns the public URL.
 *
 * @param prompt  The image prompt (can be pre-built or built here from context)
 * @param propertyContext  Listing data to enrich the prompt
 * @param propertyId  Used as storage path prefix and cost log key
 * @param postType  Influences interior vs exterior framing
 */
export async function generateLifestyleImage(
  prompt: string,
  propertyContext: ListingScrapeResult,
  propertyId: string = 'unknown',
  postType: 'interior' | 'exterior' | 'lifestyle' = 'lifestyle'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY

  if (!apiKey) {
    throw new Error(
      'Gemini API key not configured. Set GEMINI_API_KEY or GOOGLE_AI_API_KEY.'
    )
  }

  // Build a richer prompt if the caller passed a bare prompt
  const finalPrompt =
    prompt.length > 30
      ? prompt
      : buildImagePrompt(propertyContext, postType)

  let storageKey = ''
  let success = false
  let errorMessage: string | undefined

  try {
    const genAI = new GoogleGenerativeAI(apiKey)

    // Imagen 3 is accessed via the generateImages method on the correct model
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    // The Imagen API returns base64-encoded image data
    // @ts-expect-error — generateImages is present on Imagen models but not yet in type definitions
    const response = await model.generateImages({
      prompt: finalPrompt,
      number_of_images: 1,
      safety_filter_level: 'BLOCK_LOW_AND_ABOVE',
      person_generation: 'DONT_ALLOW',
    })

    const generated = response?.generatedImages?.[0]
    if (!generated?.image?.imageBytes) {
      throw new Error('Imagen returned no image data')
    }

    // imageBytes comes back as a base64 string or Uint8Array depending on SDK version
    const rawBytes = generated.image.imageBytes
    let imageBytes: Uint8Array
    if (typeof rawBytes === 'string') {
      const binary = Buffer.from(rawBytes, 'base64')
      imageBytes = new Uint8Array(binary)
    } else {
      imageBytes = rawBytes
    }

    const mimeType: string =
      (generated.image.mimeType as string | undefined) ?? 'image/png'

    const uploaded = await uploadImageToStorage(imageBytes, propertyId, mimeType)
    storageKey = uploaded.storageKey
    success = true

    await logGenerationCost({
      propertyId,
      model: GEMINI_MODEL,
      costUsd: COST_PER_IMAGE_USD,
      prompt: finalPrompt,
      storageKey,
      success: true,
    })

    return uploaded.url
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[VAEL] Image generation failed:', errorMessage)

    await logGenerationCost({
      propertyId,
      model: GEMINI_MODEL,
      costUsd: 0,
      prompt: finalPrompt,
      storageKey,
      success: false,
      errorMessage,
    })

    // Re-throw so the caller can handle gracefully
    throw err
  }
}
