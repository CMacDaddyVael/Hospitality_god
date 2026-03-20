/**
 * VAEL Lifestyle Image Generation Pipeline
 * Issue #155
 *
 * Generates 3-5 AI lifestyle photos per batch using Gemini's image generation API.
 * Images are stored in Supabase Storage and returned as ImageDeliverable objects.
 */

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListingData {
  id: string
  title: string
  description?: string
  propertyType: string // "beach condo", "mountain cabin", "urban loft", etc.
  location: string // city, state or descriptive location
  amenities: string[]
  platform?: 'airbnb' | 'vrbo'
  pricePerNight?: number
}

export interface ImageDeliverable {
  id: string
  url: string
  prompt_used: string
  season: string
  created_at: string
  listing_id: string
  status: 'pending' | 'approved' | 'rejected'
}

// ---------------------------------------------------------------------------
// Scene templates per property type + season
// ---------------------------------------------------------------------------

interface SceneTemplate {
  scene: string
  mood: string
  lighting: string
  subjects: string[]
}

const SCENE_LIBRARY: Record<string, Record<string, SceneTemplate[]>> = {
  beach: {
    summer: [
      {
        scene: 'a sun-drenched deck overlooking turquoise water, a glass of iced coffee on a wooden railing, gentle waves in the background',
        mood: 'relaxed, coastal, golden',
        lighting: 'bright morning sun, long shadows, warm golden tones',
        subjects: ['couple', 'solo traveler'],
      },
      {
        scene: 'an open sliding glass door leading to a private balcony with ocean view, sheer curtains blowing in the sea breeze, a book and sunhat left on a lounge chair',
        mood: 'breezy, aspirational, serene',
        lighting: 'midday natural light, soft coastal haze',
        subjects: ['empty scene', 'solo traveler'],
      },
      {
        scene: 'golden hour on a beach patio, two wine glasses and a charcuterie board on a weathered teak table, the ocean glowing orange-pink behind',
        mood: 'romantic, luxurious, celebratory',
        lighting: 'golden hour, warm orange backlight, lens flare',
        subjects: ['couple'],
      },
      {
        scene: 'a bright airy living room with floor-to-ceiling windows framing an ocean panorama, white linen cushions, a bowl of fresh citrus on a coffee table',
        mood: 'fresh, clean, coastal luxury',
        lighting: 'soft morning diffused light',
        subjects: ['empty scene'],
      },
      {
        scene: 'morning yoga on a beachside deck at sunrise, a rolled mat and thermos of coffee nearby, pastel sky reflecting on calm water',
        mood: 'peaceful, healthy, aspirational',
        lighting: 'sunrise gradient, lavender and peach tones',
        subjects: ['solo traveler'],
      },
    ],
    spring: [
      {
        scene: 'a breezy coastal porch with potted bougainvillea in bloom, a hammock swaying, fresh flowers on a side table',
        mood: 'fresh, romantic, colorful',
        lighting: 'soft spring afternoon light',
        subjects: ['couple', 'solo traveler'],
      },
      {
        scene: 'morning coffee ritual on a beach deck, steam rising from a mug, light mist over calm water, new-day energy',
        mood: 'quiet, restorative, hopeful',
        lighting: 'cool morning light, soft focus background',
        subjects: ['solo traveler'],
      },
    ],
    fall: [
      {
        scene: 'cozy beach cottage interior, warm throw blankets, a crackling candle, stormy ocean visible through rain-streaked windows',
        mood: 'moody, intimate, cozy',
        lighting: 'warm candlelight, cool exterior light',
        subjects: ['couple', 'empty scene'],
      },
      {
        scene: 'late afternoon on a beach deck, a glass of red wine, muted autumn sea colors, peaceful solitude',
        mood: 'contemplative, sophisticated',
        lighting: 'golden autumn light, long shadows',
        subjects: ['solo traveler'],
      },
    ],
    winter: [
      {
        scene: 'a cozy beach house living room with oversized couch, chunky knit blanket, steaming mug of cocoa, window showing a calm winter sea',
        mood: 'warm, snug, retreat',
        lighting: 'warm indoor lamp light vs cool exterior',
        subjects: ['couple', 'empty scene'],
      },
      {
        scene: 'deserted winter beach seen through a large picture window, a lit candle on the sill, reading glasses and a book on an armchair',
        mood: 'peaceful, literary, escape',
        lighting: 'flat winter daylight outside, warm interior',
        subjects: ['empty scene'],
      },
    ],
  },

  mountain: {
    summer: [
      {
        scene: 'a wraparound cabin porch at dawn, mist in the mountain valley below, two mugs of coffee on a rough-hewn log railing',
        mood: 'epic, peaceful, awe-inspiring',
        lighting: 'sunrise alpenglow, cool blue shadows',
        subjects: ['couple'],
      },
      {
        scene: 'a hammock strung between pine trees with a mountain meadow in the background, a dog resting nearby, dappled afternoon light',
        mood: 'adventurous, free, summer bliss',
        lighting: 'dappled forest light, warm afternoon',
        subjects: ['solo traveler'],
      },
      {
        scene: 'a hot tub on a mountain deck at dusk, steam rising, a forest of pine trees silhouetted against a pink-purple sky',
        mood: 'luxurious, wild, romantic',
        lighting: 'dusk gradient, warm steam glow',
        subjects: ['couple'],
      },
    ],
    fall: [
      {
        scene: 'a cabin porch surrounded by blazing autumn foliage — red, orange, gold — a steaming mug held in both hands, pure contentment',
        mood: 'cozy, harvest, vibrant',
        lighting: 'warm fall afternoon sun, saturated colors',
        subjects: ['solo traveler', 'couple'],
      },
      {
        scene: 'golden hour through a cabin window, aspen trees in fall color visible outside, a crackling fireplace inside, plaid blankets on a leather sofa',
        mood: 'warm, intimate, autumnal',
        lighting: 'golden exterior light, warm firelight interior',
        subjects: ['couple', 'empty scene'],
      },
    ],
    winter: [
      {
        scene: 'a snow-covered mountain cabin exterior at blue hour, warm light glowing from every window, smoke curling from the chimney, untouched snow on the porch steps',
        mood: 'magical, fairytale, invitation',
        lighting: 'blue hour twilight, warm window glow',
        subjects: ['empty scene'],
      },
      {
        scene: 'cozy fireplace setup in a rustic mountain cabin, two wool socks on the hearth, a cast iron pot of cocoa, snow falling outside the window',
        mood: 'deeply cozy, romantic, holiday',
        lighting: 'firelight, soft orange tones',
        subjects: ['couple', 'empty scene'],
      },
      {
        scene: 'a hot tub on a snow-laden deck, stars overhead, steam rising dramatically, pine trees heavy with snow all around',
        mood: 'adventurous, epic, romantic',
        lighting: 'night sky stars, warm tub glow, cold blue snow',
        subjects: ['couple'],
      },
    ],
    spring: [
      {
        scene: 'mountain cabin porch in early spring, snowmelt streams visible below, wildflowers just starting to bloom, morning coffee ritual',
        mood: 'renewal, peaceful, fresh start',
        lighting: 'clear morning spring light',
        subjects: ['solo traveler'],
      },
    ],
  },

  urban: {
    summer: [
      {
        scene: 'a rooftop terrace in a city loft, string lights overhead, the city skyline glittering at dusk, cocktails on a bistro table',
        mood: 'cosmopolitan, romantic, vibrant',
        lighting: 'dusk, city lights coming on, warm string lights',
        subjects: ['couple'],
      },
      {
        scene: 'a bright modern apartment with floor-to-ceiling windows open to a city balcony, morning light, a french press and fresh croissants on the kitchen counter',
        mood: 'chic, energized, city luxury',
        lighting: 'bright morning urban light',
        subjects: ['solo traveler', 'empty scene'],
      },
    ],
    fall: [
      {
        scene: 'a loft apartment window seat overlooking autumn city streets, fall foliage in a park below, a novel and latte in hand',
        mood: 'literary, cozy, urban autumn',
        lighting: 'warm fall afternoon city light',
        subjects: ['solo traveler'],
      },
    ],
    winter: [
      {
        scene: 'a modern city apartment at night, holiday lights twinkling on the skyline, a glass of red wine by the window, warm and safe inside',
        mood: 'festive, intimate, city magic',
        lighting: 'night city glow, warm interior',
        subjects: ['couple', 'solo traveler'],
      },
    ],
    spring: [
      {
        scene: 'a city apartment balcony with flowering window boxes, morning coffee, the sounds of a waking city, fresh spring energy',
        mood: 'fresh, optimistic, urban blooming',
        lighting: 'soft spring morning light',
        subjects: ['solo traveler'],
      },
    ],
  },

  lake: {
    summer: [
      {
        scene: 'a private dock at golden hour, bare feet dangling over calm water, a cold beer in hand, kayaks tied up nearby',
        mood: 'pure summer, nostalgic, perfect',
        lighting: 'golden hour lake reflections, warm',
        subjects: ['solo traveler', 'couple'],
      },
      {
        scene: 'a lakefront cabin porch with Adirondack chairs, a cornhole game in the yard, kids playing at the water\'s edge in the distance',
        mood: 'family fun, summer vacation, wholesome',
        lighting: 'bright afternoon summer light',
        subjects: ['family'],
      },
    ],
    fall: [
      {
        scene: 'a lake cabin dock in peak fall color, reflection of red and gold trees in mirror-still water, a canoe tied up, absolute stillness',
        mood: 'breathtaking, peaceful, seasonal',
        lighting: 'overcast fall light, vivid reflections',
        subjects: ['empty scene', 'couple'],
      },
    ],
    winter: [
      {
        scene: 'a lakehouse wrapped in snow, frozen lake in background, warm amber light from the windows, smoke from the chimney',
        mood: 'serene, cozy, winter wonderland',
        lighting: 'blue winter daylight, warm interior glow',
        subjects: ['empty scene'],
      },
    ],
    spring: [
      {
        scene: 'first morning on the dock after winter — a thermos of coffee, mist lifting off the lake, migratory birds returning, pure renewal',
        mood: 'hopeful, quiet, seasonal',
        lighting: 'cool early morning spring light, mist',
        subjects: ['solo traveler'],
      },
    ],
  },

  desert: {
    summer: [
      {
        scene: 'a sleek desert villa infinity pool at dusk, saguaro cacti silhouetted against a blazing orange and purple sky',
        mood: 'dramatic, luxurious, iconic Southwest',
        lighting: 'dusk sunset, dramatic sky, warm pool light',
        subjects: ['couple', 'empty scene'],
      },
    ],
    fall: [
      {
        scene: 'a desert retreat patio with string lights, the Milky Way visible overhead, a fire pit glowing, the silence of the desert all around',
        mood: 'magical, stargazing, vast',
        lighting: 'night sky with stars, fire pit glow',
        subjects: ['couple'],
      },
    ],
    winter: [
      {
        scene: 'a cozy desert cabin on a crisp winter morning, snow-dusted red rock formations in the distance, a warm fire inside seen through the window',
        mood: 'unexpected cozy, dramatic, peaceful',
        lighting: 'clear winter desert light, warm interior',
        subjects: ['empty scene'],
      },
    ],
    spring: [
      {
        scene: 'a desert property surrounded by blooming wildflowers after spring rains, golden poppies and purple lupine, a hammock in the shade of a palo verde tree',
        mood: 'magical, rare beauty, superbloom',
        lighting: 'warm spring morning desert light',
        subjects: ['solo traveler'],
      },
    ],
  },

  // Fallback for any other property type
  default: {
    summer: [
      {
        scene: 'a beautiful vacation rental property in summer, a welcoming porch with comfortable seating, lush greenery, inviting and aspirational',
        mood: 'welcoming, beautiful, escape',
        lighting: 'warm afternoon light',
        subjects: ['empty scene'],
      },
      {
        scene: 'a sunlit vacation home interior, fresh flowers on a dining table, light streaming through open windows, the promise of a perfect getaway',
        mood: 'bright, hopeful, inviting',
        lighting: 'natural daylight, clean and warm',
        subjects: ['empty scene'],
      },
    ],
    fall: [
      {
        scene: 'a vacation rental surrounded by fall foliage, a porch with a warm blanket and steaming mug, cozy and seasonal',
        mood: 'cozy, seasonal, welcoming',
        lighting: 'warm fall afternoon',
        subjects: ['solo traveler'],
      },
    ],
    winter: [
      {
        scene: 'a cozy vacation home in winter, fireplace lit, warm lighting, a refuge from the cold, deeply inviting',
        mood: 'warm, cozy, refuge',
        lighting: 'firelight and warm lamps',
        subjects: ['couple', 'empty scene'],
      },
    ],
    spring: [
      {
        scene: 'a fresh vacation rental in spring, blooming flowers in the yard, open windows, the feeling of renewal and escape',
        mood: 'fresh, hopeful, colorful',
        lighting: 'soft spring light',
        subjects: ['empty scene'],
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Amenity-based scene modifiers
// ---------------------------------------------------------------------------

const AMENITY_SCENE_BOOSTERS: Record<string, string> = {
  'hot tub': 'with a steaming hot tub visible on the deck',
  'pool': 'with a sparkling private pool reflecting the sky',
  'fireplace': 'with a crackling stone fireplace as the focal point',
  'fire pit': 'with a lit fire pit surrounded by Adirondack chairs',
  'ocean view': 'with a sweeping panoramic ocean view as the backdrop',
  'mountain view': 'with dramatic mountain peaks visible in the distance',
  'lake view': 'with a serene lake view framing the scene',
  'private dock': 'with a private wooden dock extending over calm water',
  'rooftop deck': 'featuring a rooftop terrace with city views',
  'chef kitchen': 'with a professional chef\'s kitchen visible in the background',
  'game room': '',
  'gym': '',
  'sauna': 'with a cedar sauna adding a wellness spa feel',
  'outdoor shower': 'with a rustic outdoor shower framed by tropical plants',
  'kayaks': 'with kayaks and paddleboards ready at the water\'s edge',
  'bikes': 'with bicycles available beside the front door',
  'bbq': 'with a premium gas grill set up for the perfect cookout',
  'grill': 'with a premium grill loaded and ready on the patio',
  'wine cellar': 'with a glass-fronted wine cellar visible in the background',
  'theater room': '',
  'ski-in/ski-out': 'with ski equipment against the wall and slopes visible outside',
  'beach access': 'with direct beach access just steps from the door',
  'workspace': '',
  'ev charger': '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyPropertyType(
  propertyType: string,
  location: string,
  amenities: string[]
): string {
  const combined = `${propertyType} ${location} ${amenities.join(' ')}`.toLowerCase()

  if (
    combined.includes('beach') ||
    combined.includes('coastal') ||
    combined.includes('ocean') ||
    combined.includes('surf') ||
    combined.includes('seaside') ||
    combined.includes('gulf') ||
    combined.includes('shore')
  ) {
    return 'beach'
  }

  if (
    combined.includes('mountain') ||
    combined.includes('cabin') ||
    combined.includes('ski') ||
    combined.includes('alpine') ||
    combined.includes('forest') ||
    combined.includes('lodge') ||
    combined.includes('chalet')
  ) {
    return 'mountain'
  }

  if (
    combined.includes('lake') ||
    combined.includes('lakefront') ||
    combined.includes('lakeside') ||
    combined.includes('waterfront') ||
    combined.includes('pond')
  ) {
    return 'lake'
  }

  if (
    combined.includes('desert') ||
    combined.includes('arizona') ||
    combined.includes('sedona') ||
    combined.includes('scottsdale') ||
    combined.includes('palm spring') ||
    combined.includes('joshua tree') ||
    combined.includes('new mexico') ||
    combined.includes('santa fe') ||
    combined.includes('moab') ||
    combined.includes('tucson')
  ) {
    return 'desert'
  }

  if (
    combined.includes('city') ||
    combined.includes('urban') ||
    combined.includes('downtown') ||
    combined.includes('loft') ||
    combined.includes('apartment') ||
    combined.includes('condo') ||
    combined.includes('studio') ||
    combined.includes('new york') ||
    combined.includes('chicago') ||
    combined.includes('seattle') ||
    combined.includes('los angeles') ||
    combined.includes('san francisco') ||
    combined.includes('miami') ||
    combined.includes('brooklyn') ||
    combined.includes('manhattan')
  ) {
    return 'urban'
  }

  return 'default'
}

function normalizeSeason(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('spring') || s.includes('march') || s.includes('april') || s.includes('may')) return 'spring'
  if (s.includes('summer') || s.includes('june') || s.includes('july') || s.includes('august')) return 'summer'
  if (s.includes('fall') || s.includes('autumn') || s.includes('sept') || s.includes('oct') || s.includes('nov')) return 'fall'
  if (s.includes('winter') || s.includes('dec') || s.includes('jan') || s.includes('feb')) return 'winter'
  return 'summer' // sensible default
}

function pickAmenityBooster(amenities: string[]): string {
  const normalizedAmenities = amenities.map((a) => a.toLowerCase())
  for (const amenity of normalizedAmenities) {
    for (const [key, booster] of Object.entries(AMENITY_SCENE_BOOSTERS)) {
      if (amenity.includes(key) && booster) {
        return booster
      }
    }
  }
  return ''
}

function selectScenes(
  propertyClass: string,
  normalizedSeason: string,
  count: number
): SceneTemplate[] {
  const seasonalScenes =
    SCENE_LIBRARY[propertyClass]?.[normalizedSeason] ||
    SCENE_LIBRARY['default'][normalizedSeason] ||
    SCENE_LIBRARY['default']['summer']

  // If we don't have enough scenes in the classified type, pad with defaults
  let pool = [...seasonalScenes]
  if (pool.length < count) {
    const defaultScenes = SCENE_LIBRARY['default'][normalizedSeason] || SCENE_LIBRARY['default']['summer']
    pool = [...pool, ...defaultScenes]
  }

  // Shuffle and pick `count` unique scenes
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

export function buildImagePrompt(
  listing: ListingData,
  scene: SceneTemplate,
  season: string,
  amenityBooster: string
): string {
  const locationContext = listing.location
    ? `in ${listing.location}`
    : ''

  const amenityContext = amenityBooster
    ? `, ${amenityBooster}`
    : ''

  const prompt = [
    `Lifestyle photograph of ${scene.scene}${amenityContext}.`,
    `Setting: ${listing.propertyType} vacation rental property ${locationContext}.`,
    `Season: ${season}.`,
    `Mood: ${scene.mood}.`,
    `Lighting: ${scene.lighting}.`,
    `Style: aspirational Instagram-worthy real estate lifestyle photography,`,
    `editorial quality, shot on a professional mirrorless camera,`,
    `shallow depth of field, warm color grading, natural and authentic,`,
    `no text, no watermarks, no logos, photorealistic.`,
    `The image should make a viewer immediately want to book this property.`,
    `Composition: rule of thirds, leading lines, inviting and immersive.`,
  ].join(' ')

  return prompt
}

// ---------------------------------------------------------------------------
// Gemini image generation
// ---------------------------------------------------------------------------

async function callGeminiImageGeneration(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  // Gemini 2.0 Flash image generation endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 1.0,
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const responseData = await response.json()

  // Extract the image data from the response
  const candidate = responseData?.candidates?.[0]
  if (!candidate) {
    throw new Error('No candidates returned from Gemini API')
  }

  const imagePart = candidate.content?.parts?.find(
    (part: { inlineData?: { mimeType?: string; data?: string }; text?: string }) =>
      part.inlineData?.mimeType?.startsWith('image/')
  )

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image data in Gemini API response')
  }

  // Decode base64 image data
  return Buffer.from(imagePart.inlineData.data, 'base64')
}

// ---------------------------------------------------------------------------
// Supabase Storage upload
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createClient(supabaseUrl, supabaseKey)
}

async function uploadImageToSupabase(
  imageBuffer: Buffer,
  listingId: string,
  imageId: string
): Promise<string> {
  const supabase = getSupabaseClient()

  const storagePath = `property/${listingId}/lifestyle/${imageId}.png`

  const { error } = await supabase.storage
    .from('lifestyle-images')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false,
    })

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('lifestyle-images')
    .getPublicUrl(storagePath)

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL from Supabase')
  }

  return urlData.publicUrl
}

// ---------------------------------------------------------------------------
// Deliverable persistence
// ---------------------------------------------------------------------------

async function saveDeliverableRecord(deliverable: ImageDeliverable): Promise<void> {
  const supabase = getSupabaseClient()

  const { error } = await supabase.from('lifestyle_image_deliverables').insert({
    id: deliverable.id,
    listing_id: deliverable.listing_id,
    url: deliverable.url,
    prompt_used: deliverable.prompt_used,
    season: deliverable.season,
    status: deliverable.status,
    created_at: deliverable.created_at,
  })

  if (error) {
    // Log but don't throw — the image is already in Storage; record is a nice-to-have for now
    console.error('Failed to persist deliverable record:', error.message)
  }
}

// ---------------------------------------------------------------------------
// Main export: generateLifestyleImages
// ---------------------------------------------------------------------------

export async function generateLifestyleImages(
  listing: ListingData,
  season: string,
  count: number = 3
): Promise<ImageDeliverable[]> {
  // Clamp count to valid range
  const imageCount = Math.min(Math.max(count, 1), 5)
  const normalizedSeason = normalizeSeason(season)
  const propertyClass = classifyPropertyType(
    listing.propertyType,
    listing.location,
    listing.amenities
  )
  const amenityBooster = pickAmenityBooster(listing.amenities)

  console.log(
    `[ImageGen] Generating ${imageCount} lifestyle images for listing ${listing.id}` +
    ` | class: ${propertyClass} | season: ${normalizedSeason}`
  )

  const scenes = selectScenes(propertyClass, normalizedSeason, imageCount)
  const deliverables: ImageDeliverable[] = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const imageId = uuidv4()
    const prompt = buildImagePrompt(listing, scene, normalizedSeason, amenityBooster)

    console.log(`[ImageGen] Generating image ${i + 1}/${scenes.length} — prompt: ${prompt.slice(0, 80)}...`)

    try {
      const imageBuffer = await callGeminiImageGeneration(prompt)
      const publicUrl = await uploadImageToSupabase(imageBuffer, listing.id, imageId)

      const deliverable: ImageDeliverable = {
        id: imageId,
        url: publicUrl,
        prompt_used: prompt,
        season: normalizedSeason,
        created_at: new Date().toISOString(),
        listing_id: listing.id,
        status: 'pending',
      }

      await saveDeliverableRecord(deliverable)
      deliverables.push(deliverable)

      console.log(`[ImageGen] ✓ Image ${i + 1} stored at ${publicUrl}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`[ImageGen] ✗ Image ${i + 1} failed: ${errorMessage}`)
      // Continue generating remaining images even if one fails
    }
  }

  if (deliverables.length === 0) {
    throw new Error(
      `All ${scenes.length} image generations failed for listing ${listing.id}. Check GEMINI_API_KEY and Supabase config.`
    )
  }

  console.log(
    `[ImageGen] ✓ Batch complete: ${deliverables.length}/${imageCount} images generated for listing ${listing.id}`
  )

  return deliverables
}
