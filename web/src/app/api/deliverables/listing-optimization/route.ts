import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildListingRewritePrompt(listing: ListingData, variationSeed?: number): string {
  const variationInstruction = variationSeed
    ? `\n\nVARIATION SEED: ${variationSeed}. You MUST produce a meaningfully different version from any previous draft — different opening angle, different amenity emphasis, different sentence structures. Do not simply reshuffle the same sentences.`
    : ''

  return `You are an expert Airbnb listing copywriter. Your job is to rewrite a short-term rental listing so it ranks higher in Airbnb search and converts more browsers into bookings.

## INPUT LISTING DATA
Title: ${listing.title || '(no title provided)'}
Description: ${listing.description || '(no description provided)'}
Location: ${listing.location || 'Unknown'}
Property Type: ${listing.propertyType || 'Unknown'}
Price per Night: ${listing.pricePerNight ? `$${listing.pricePerNight}` : 'Unknown'}
Amenities: ${listing.amenities?.length ? listing.amenities.join(', ') : 'None listed'}
Highlights/Features: ${listing.highlights?.length ? listing.highlights.join(', ') : 'None listed'}
Rating: ${listing.rating || 'No rating'} (${listing.reviewCount || 0} reviews)

## COPY RULES — FOLLOW THESE EXACTLY

### Title rules (MAX 50 characters including spaces):
- Lead with the single most searchable amenity OR a strong location hook
- Be specific and concrete — "Pool + Ocean View" beats "Beautiful Home"
- No filler words: no "charming," "cozy," "perfect," "wonderful," "amazing," "stunning," "nestled," "gorgeous"
- No emojis
- Count characters carefully — 50 is a hard limit

### Description rules (~400 words):
- Open with a guest-POV benefit statement in the first sentence — what the guest EXPERIENCES, not what you have
- Second paragraph: the property's best physical features (views, layout, outdoor space)
- Third paragraph: standout amenities that matter to booking decisions (pool, hot tub, fast wifi, EV charger, etc.)
- Fourth paragraph: the neighborhood / location advantages
- Close with a simple practical summary (sleeps X, bedrooms, bathrooms)
- Write in second person ("You'll wake up to…", "Your mornings start with…")
- No filler phrases: "nestled," "charming," "perfect for," "ideal for," "home away from home," "cozy retreat," "stunning," "luxurious," "amazing," "beautiful," "wonderful"
- No emojis
- No markdown — plain prose paragraphs only
- No asterisks, no bullet points, no headers within the description
- Active voice, short punchy sentences mixed with longer descriptive ones

### Highlights rules (exactly 5 bullets):
- Each bullet starts with "You'll" — second person
- Each bullet is one crisp sentence, 10–20 words
- Lead each bullet with the most important word (the amenity or feature), not "You'll have access to a..."
- Concrete and specific — no vague claims
- No emojis, no markdown, no asterisks
- No filler phrases

## OUTPUT FORMAT
Return ONLY valid JSON with this exact structure — no preamble, no explanation, no markdown code fences:

{
  "title": "string — max 50 chars",
  "title_char_count": number,
  "description": "string — plain prose, ~400 words, no markdown",
  "description_word_count": number,
  "highlights": [
    "string — one sentence starting with You'll",
    "string — one sentence starting with You'll",
    "string — one sentence starting with You'll",
    "string — one sentence starting with You'll",
    "string — one sentence starting with You'll"
  ]
}${variationInstruction}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingData {
  title?: string
  description?: string
  location?: string
  propertyType?: string
  pricePerNight?: number
  amenities?: string[]
  highlights?: string[]
  rating?: number
  reviewCount?: number
}

interface ClaudeOutput {
  title: string
  title_char_count: number
  description: string
  description_word_count: number
  highlights: string[]
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

async function generateListingRewrite(
  listing: ListingData,
  variationSeed?: number
): Promise<ClaudeOutput> {
  const prompt = buildListingRewritePrompt(listing, variationSeed)

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Strip markdown code fences if Claude adds them anyway
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let parsed: ClaudeOutput
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }

  // Enforce hard limits
  if (parsed.title.length > 50) {
    parsed.title = parsed.title.slice(0, 50).trim()
  }
  parsed.title_char_count = parsed.title.length
  parsed.description_word_count = parsed.description.split(/\s+/).filter(Boolean).length

  if (!Array.isArray(parsed.highlights) || parsed.highlights.length !== 5) {
    throw new Error('Claude did not return exactly 5 highlights')
  }

  return parsed
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getProperty(propertyId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (error) throw new Error(`Property not found: ${error.message}`)
  return data
}

async function getScrapedListing(propertyId: string) {
  // Try scraped_listings table first
  const { data: scraped } = await supabase
    .from('scraped_listings')
    .select('*')
    .eq('property_id', propertyId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single()

  if (scraped) return scraped

  // Fall back to property record itself (which may have listing_data JSONB)
  const { data: property } = await supabase
    .from('properties')
    .select('listing_data, title, description, location, amenities')
    .eq('id', propertyId)
    .single()

  return property
}

async function writeDeliverables(
  propertyId: string,
  groupId: string,
  original: ListingData,
  output: ClaudeOutput,
  variationSeed?: number
) {
  const now = new Date().toISOString()
  const seed = variationSeed ?? null

  const deliverables = [
    {
      id: randomUUID(),
      property_id: propertyId,
      deliverable_group_id: groupId,
      type: 'listing_title',
      status: 'pending_review',
      original_content: original.title ?? null,
      generated_content: output.title,
      metadata: {
        char_count: output.title_char_count,
        char_limit: 50,
        variation_seed: seed,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      property_id: propertyId,
      deliverable_group_id: groupId,
      type: 'listing_description',
      status: 'pending_review',
      original_content: original.description ?? null,
      generated_content: output.description,
      metadata: {
        word_count: output.description_word_count,
        variation_seed: seed,
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: randomUUID(),
      property_id: propertyId,
      deliverable_group_id: groupId,
      type: 'listing_highlights',
      status: 'pending_review',
      original_content: original.highlights ? original.highlights.join('\n') : null,
      generated_content: output.highlights.join('\n'),
      metadata: {
        bullet_count: 5,
        variation_seed: seed,
      },
      created_at: now,
      updated_at: now,
    },
  ]

  const { error } = await supabase.from('deliverables').insert(deliverables)
  if (error) throw new Error(`Failed to write deliverables: ${error.message}`)

  return deliverables
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { property_id, variation_seed } = body

    if (!property_id) {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
    }

    // 1. Pull scraped listing data
    let scrapedData: ListingData
    try {
      const raw = await getScrapedListing(property_id)
      // Normalize — the scraped record may have a listing_data JSONB column
      // or it may be a flat row
      if (raw?.listing_data) {
        scrapedData = raw.listing_data as ListingData
      } else {
        scrapedData = {
          title: raw?.title,
          description: raw?.description,
          location: raw?.location,
          propertyType: raw?.property_type,
          pricePerNight: raw?.price_per_night,
          amenities: raw?.amenities,
          highlights: raw?.highlights,
          rating: raw?.rating,
          reviewCount: raw?.review_count,
        }
      }
    } catch {
      // If no scraped data exists, try to get basic property info
      try {
        const property = await getProperty(property_id)
        scrapedData = {
          title: property.title ?? property.name ?? '',
          description: property.description ?? '',
          location: property.location ?? property.city ?? '',
          propertyType: property.property_type ?? '',
          pricePerNight: property.price_per_night ?? 0,
          amenities: property.amenities ?? [],
        }
      } catch {
        return NextResponse.json(
          { error: 'No listing data found for this property. Please scrape the listing first.' },
          { status: 404 }
        )
      }
    }

    // 2. Generate rewrite via Claude
    const output = await generateListingRewrite(scrapedData, variation_seed)

    // 3. Write deliverables to DB
    const groupId = randomUUID()
    const deliverables = await writeDeliverables(
      property_id,
      groupId,
      scrapedData,
      output,
      variation_seed
    )

    return NextResponse.json({
      success: true,
      deliverable_group_id: groupId,
      deliverables: deliverables.map((d) => ({
        id: d.id,
        type: d.type,
        original_content: d.original_content,
        generated_content: d.generated_content,
        metadata: d.metadata,
        status: d.status,
      })),
      generated: {
        title: output.title,
        title_char_count: output.title_char_count,
        description: output.description,
        description_word_count: output.description_word_count,
        highlights: output.highlights,
      },
    })
  } catch (error) {
    console.error('Listing optimization error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate listing optimization', detail: message },
      { status: 500 }
    )
  }
}
