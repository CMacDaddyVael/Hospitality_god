/**
 * VAEL Hospitality Image Generation
 * Adapts VAEL's retail lifestyle shot tech for STR property photography.
 * Input: flat property photos → Output: lifestyle images with people in the space
 */

import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Season Detection ───────────────────────────────────────────────────────

export function getCurrentSeason() {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const day = now.getDate()

  // Holiday windows take priority
  if ((month === 12 && day >= 1) || (month === 1 && day <= 5)) {
    return 'winter_holidays'
  }
  if (month === 10 && day >= 15) {
    return 'fall_halloween'
  }
  if (month === 11) {
    return 'fall_thanksgiving'
  }
  if (month === 2 && day >= 1 && day <= 20) {
    return 'winter_valentines'
  }
  if (month === 3 && day >= 15 || month === 4 && day <= 15) {
    return 'spring'
  }

  // Standard seasons
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export function getUpcomingSeason() {
  const now = new Date()
  const month = now.getMonth() + 1

  // Look ~6 weeks ahead
  const future = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000)
  const futureMonth = future.getMonth() + 1

  if (futureMonth !== month) {
    const futureDate = new Date(future)
    futureDate.setDate(1)
    const tempNow = new Date()
    tempNow.setMonth(futureMonth - 1)
    return getCurrentSeasonForMonth(futureMonth)
  }
  return getCurrentSeason()
}

function getCurrentSeasonForMonth(month) {
  if (month === 12 || month === 1) return 'winter_holidays'
  if (month === 10 || month === 11) return 'fall'
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  return 'winter'
}

// ─── Lifestyle Scene Definitions ─────────────────────────────────────────────

export const SCENE_TYPES = {
  couple_coffee: {
    id: 'couple_coffee',
    label: 'Morning Coffee',
    description: 'Couple having coffee together',
    guestTypes: ['couple'],
    amenityRequired: ['balcony', 'patio', 'deck', 'outdoor_seating'],
    fallback: 'kitchen',
  },
  family_kitchen: {
    id: 'family_kitchen',
    label: 'Family Cooking',
    description: 'Family cooking together in the kitchen',
    guestTypes: ['family'],
    amenityRequired: ['kitchen', 'full_kitchen'],
    fallback: 'dining',
  },
  friends_pool: {
    id: 'friends_pool',
    label: 'Pool Hangout',
    description: 'Friends lounging by the pool',
    guestTypes: ['group'],
    amenityRequired: ['pool', 'hot_tub', 'jacuzzi'],
    fallback: null,
  },
  solo_fireplace: {
    id: 'solo_fireplace',
    label: 'Cozy by the Fire',
    description: 'Solo traveler reading by the fireplace',
    guestTypes: ['solo', 'couple'],
    amenityRequired: ['fireplace'],
    fallback: 'living_room',
  },
  kids_backyard: {
    id: 'kids_backyard',
    label: 'Backyard Play',
    description: 'Kids playing in the backyard',
    guestTypes: ['family'],
    amenityRequired: ['backyard', 'yard', 'garden'],
    fallback: null,
  },
  sunset_drinks: {
    id: 'sunset_drinks',
    label: 'Sunset Drinks',
    description: 'Couple with drinks at sunset on the patio',
    guestTypes: ['couple', 'group'],
    amenityRequired: ['balcony', 'patio', 'deck', 'rooftop'],
    fallback: null,
  },
  bbq_patio: {
    id: 'bbq_patio',
    label: 'BBQ on the Patio',
    description: 'Friends grilling and socializing on the patio',
    guestTypes: ['group', 'family'],
    amenityRequired: ['bbq', 'grill', 'patio', 'outdoor_dining'],
    fallback: null,
  },
  morning_yoga: {
    id: 'morning_yoga',
    label: 'Morning Yoga',
    description: 'Guest doing yoga on the balcony or lawn',
    guestTypes: ['solo', 'couple'],
    amenityRequired: ['balcony', 'garden', 'yard', 'patio'],
    fallback: null,
  },
  cozy_reading: {
    id: 'cozy_reading',
    label: 'Cozy Reading Nook',
    description: 'Guest reading in a cozy corner',
    guestTypes: ['solo', 'couple'],
    amenityRequired: [],
    fallback: 'living_room',
  },
  wine_evening: {
    id: 'wine_evening',
    label: 'Evening Wine',
    description: 'Couple sharing wine in the evening',
    guestTypes: ['couple'],
    amenityRequired: [],
    fallback: 'living_room',
  },
}

// ─── Seasonal Styling Modifiers ───────────────────────────────────────────────

export const SEASONAL_MODIFIERS = {
  spring: {
    label: 'Spring',
    lighting: 'soft morning light, fresh and bright',
    atmosphere: 'fresh flowers visible, open windows, light breeze, green foliage',
    wardrobe: 'light layers, pastel colors, casual spring attire',
    props: 'fresh flowers in vases, light blankets, open books',
    colorGrade: 'bright, airy, soft greens and pinks',
    timeOfDay: 'morning or late afternoon',
  },
  summer: {
    label: 'Summer',
    lighting: 'golden hour sunlight, warm and vibrant',
    atmosphere: 'lush greenery, blue skies, summery and energetic',
    wardrobe: 'casual summer wear, swimwear near pool, sundresses, shorts',
    props: 'cold drinks, sunglasses, towels, fresh fruit',
    colorGrade: 'warm, saturated, golden tones',
    timeOfDay: 'golden hour or midday',
  },
  fall: {
    label: 'Fall',
    lighting: 'warm golden-amber afternoon light',
    atmosphere: 'autumn leaves visible through windows, warm and cozy mood',
    wardrobe: 'cozy sweaters, flannel, warm earth tones',
    props: 'pumpkins, candles, warm mugs, throw blankets',
    colorGrade: 'warm amber and orange tones, rich and moody',
    timeOfDay: 'late afternoon',
  },
  fall_halloween: {
    label: 'Fall/Halloween',
    lighting: 'warm amber light, moody',
    atmosphere: 'tasteful Halloween decor, pumpkins, autumn leaves',
    wardrobe: 'cozy sweaters, warm colors',
    props: 'carved pumpkins, candles, spiced drinks, fall foliage arrangements',
    colorGrade: 'deep oranges, amber, warm moody tones',
    timeOfDay: 'late afternoon to evening',
  },
  fall_thanksgiving: {
    label: 'Fall/Thanksgiving',
    lighting: 'warm indoor lighting, golden',
    atmosphere: 'gathering and family warmth, harvest decor',
    wardrobe: 'casual comfortable, layered',
    props: 'harvest decorations, candles, warm food and drinks',
    colorGrade: 'warm golds and browns, inviting',
    timeOfDay: 'late afternoon',
  },
  winter: {
    label: 'Winter',
    lighting: 'soft indoor warm light, cozy and intimate',
    atmosphere: 'cozy and warm inside, cold outside visible through windows',
    wardrobe: 'cozy sweaters, robes, warm socks',
    props: 'thick blankets, hot drinks, books, candles',
    colorGrade: 'warm indoor tones, cool blues through windows',
    timeOfDay: 'evening or morning',
  },
  winter_holidays: {
    label: 'Holiday Season',
    lighting: 'warm twinkle lights, festive glow, firelight',
    atmosphere: 'holiday magic — tasteful lights, festive but not gaudy, joyful',
    wardrobe: 'cozy holiday attire, soft sweaters, festive touches',
    props: 'holiday lights, candles, hot cocoa, elegant simple holiday decor',
    colorGrade: 'warm golden and red tones, magical',
    timeOfDay: 'evening, magical lighting',
  },
  winter_valentines: {
    label: "Valentine's Day",
    lighting: 'soft romantic lighting, candles',
    atmosphere: 'romantic and intimate, couples retreat',
    wardrobe: 'elegant casual, romantic',
    props: 'candles, wine, flowers, cozy blankets',
    colorGrade: 'warm romantic tones, soft reds and pinks',
    timeOfDay: 'evening',
  },
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildLifestylePrompt({ scene, season, property, roomPhoto }) {
  const seasonMod = SEASONAL_MODIFIERS[season] || SEASONAL_MODIFIERS.summer
  const sceneType = SCENE_TYPES[scene] || SCENE_TYPES.cozy_reading

  const propertyContext = property
    ? `
Property type: ${property.propertyType || 'vacation rental'}
Location: ${property.location || 'scenic location'}
Amenities: ${(property.amenities || []).slice(0, 10).join(', ')}
`.trim()
    : ''

  return `You are a professional lifestyle photographer creating aspirational vacation rental imagery.

TASK: Transform this property photo into a lifestyle shot showing real guests enjoying the space.

SCENE: ${sceneType.description}
GUESTS: ${sceneType.guestTypes.join(' or ')} — show ${sceneType.guestTypes[0]}(s) naturally using this space

SEASON: ${seasonMod.label}
- Lighting: ${seasonMod.lighting}
- Atmosphere: ${seasonMod.atmosphere}
- Guest wardrobe: ${seasonMod.wardrobe}
- Props and details: ${seasonMod.props}
- Color grade: ${seasonMod.colorGrade}
- Time of day: ${seasonMod.timeOfDay}

${propertyContext}

PHOTOGRAPHY STYLE REQUIREMENTS:
- Editorial lifestyle photography, not staged or artificial
- Natural candid feel — guests look genuinely happy and relaxed
- Guests are diverse, aspirational, relatable — not stock photo generic
- The property/space is the hero — guests complement it, not overwhelm it
- Photorealistic, high-resolution, professional photography quality
- No text, watermarks, or artificial elements
- Maintain the actual architecture, furniture, and layout of the property shown

COMPOSITION: ${sceneType.description} — medium shot showing both guests and the space clearly
MOOD: Aspirational but attainable — viewers should think "I want to be there"

OUTPUT: Single photorealistic lifestyle image suitable for Instagram and Airbnb listing.`
}

// ─── Core Generation Function ─────────────────────────────────────────────────

export async function generateLifestyleImage({ propertyId, scene, season, sourceImageUrl, property }) {
  const prompt = buildLifestylePrompt({ scene, season, property, roomPhoto: sourceImageUrl })

  try {
    // If we have a source image, use image editing / inpainting approach
    // Otherwise generate from text description of the property
    let response

    if (sourceImageUrl) {
      // Download the source image
      const imageBuffer = await downloadImage(sourceImageUrl)
      const base64Image = imageBuffer.toString('base64')
      const mimeType = detectMimeType(sourceImageUrl)

      // Use Gemini's image generation with reference image
      response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['image', 'text'],
          temperature: 0.9,
        },
      })
    } else {
      // Text-only generation
      response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['image', 'text'],
          temperature: 0.9,
        },
      })
    }

    // Extract image from response
    const imageData = extractImageFromResponse(response)
    if (!imageData) {
      throw new Error('No image generated in response')
    }

    return imageData
  } catch (error) {
    // Fallback: try Imagen 3 if available
    console.error('Gemini generation error, trying Imagen fallback:', error.message)
    return await generateWithImagen({ prompt, propertyId, scene, season })
  }
}

async function generateWithImagen({ prompt, propertyId, scene, season }) {
  try {
    const response = await genAI.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `Professional lifestyle vacation rental photography. ${prompt}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '4:3',
        personGeneration: 'allow_adult',
      },
    })

    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0]
      return {
        data: img.image.imageBytes,
        mimeType: 'image/jpeg',
        source: 'imagen3',
      }
    }

    throw new Error('No images returned from Imagen')
  } catch (error) {
    throw new Error(`Image generation failed: ${error.message}`)
  }
}

function extractImageFromResponse(response) {
  if (!response?.candidates?.[0]?.content?.parts) return null

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        source: 'gemini',
      }
    }
  }
  return null
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

export async function storeGeneratedImage({ propertyId, imageData, scene, season, sourceImageUrl }) {
  const { data: imageBuffer, mimeType } = imageData

  // Convert base64 to buffer if needed
  const buffer = typeof imageBuffer === 'string'
    ? Buffer.from(imageBuffer, 'base64')
    : Buffer.from(imageBuffer)

  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const filename = `${propertyId}/${season}/${scene}_${Date.now()}.${ext}`

  // Upload to Supabase Storage
  const { data: upload, error: uploadError } = await supabase.storage
    .from('property-media')
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('property-media')
    .getPublicUrl(filename)

  // Save metadata to database
  const { data: record, error: dbError } = await supabase
    .from('property_media')
    .insert({
      property_id: propertyId,
      storage_path: filename,
      public_url: publicUrl,
      media_type: 'lifestyle_generated',
      scene_type: scene,
      season,
      source_image_url: sourceImageUrl || null,
      status: 'pending_review',
      metadata: {
        generated_at: new Date().toISOString(),
        mime_type: mimeType,
        image_source: imageData.source,
      },
    })
    .select()
    .single()

  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

  return { record, publicUrl }
}

// ─── Batch Generation ─────────────────────────────────────────────────────────

export async function generateSeasonalBatch({ propertyId, property, season, scenes, concurrency = 2 }) {
  const results = []
  const errors = []

  // Filter scenes to ones that make sense for this property's amenities
  const applicableScenes = filterScenesForProperty(scenes, property)

  console.log(`Generating ${applicableScenes.length} lifestyle images for property ${propertyId}, season: ${season}`)

  // Process in batches to avoid rate limits
  for (let i = 0; i < applicableScenes.length; i += concurrency) {
    const batch = applicableScenes.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map(async ({ scene, sourceImageUrl }) => {
        console.log(`  Generating: ${scene} (${season})`)

        const imageData = await generateLifestyleImage({
          propertyId,
          scene,
          season,
          sourceImageUrl,
          property,
        })

        const stored = await storeGeneratedImage({
          propertyId,
          imageData,
          scene,
          season,
          sourceImageUrl,
        })

        return { scene, season, ...stored }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        errors.push(result.reason?.message || 'Unknown error')
        console.error('  Generation failed:', result.reason?.message)
      }
    }

    // Rate limit pause between batches
    if (i + concurrency < applicableScenes.length) {
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  return { results, errors }
}

export function filterScenesForProperty(scenes, property) {
  const amenities = (property?.amenities || []).map(a => a.toLowerCase())

  return scenes.filter(({ scene }) => {
    const sceneConfig = SCENE_TYPES[scene]
    if (!sceneConfig) return false

    // If scene requires specific amenities, check if property has any of them
    if (sceneConfig.amenityRequired.length > 0) {
      const hasAmenity = sceneConfig.amenityRequired.some(required =>
        amenities.some(a => a.includes(required) || required.includes(a))
      )
      // Allow if has amenity OR has fallback (we'll use living room, etc.)
      return hasAmenity || sceneConfig.fallback !== null
    }

    return true
  })
}

// ─── Auto-Schedule Rotation ───────────────────────────────────────────────────

export async function getScheduledRotation(propertyId) {
  const currentSeason = getCurrentSeason()
  const upcomingSeason = getUpcomingSeason()

  const { data: media } = await supabase
    .from('property_media')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  const currentSeasonImages = (media || []).filter(m => m.season === currentSeason)
  const upcomingSeasonImages = (media || []).filter(m => m.season === upcomingSeason)

  return {
    currentSeason,
    upcomingSeason,
    currentSeasonImages,
    upcomingSeasonImages,
    needsGeneration: currentSeasonImages.length === 0,
    needsUpcomingGeneration: upcomingSeasonImages.length === 0 && currentSeason !== upcomingSeason,
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function detectMimeType(url) {
  const lower = url.toLowerCase()
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}
