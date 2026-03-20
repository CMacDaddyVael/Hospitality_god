/**
 * queueListingCopyDeliverable
 *
 * Creates a `listing_copy` deliverable record immediately after Pro checkout so
 * the owner sees rewritten listing content when they first open the dashboard.
 *
 * Uses the same Claude prompt pattern as the rest of the content pipeline, but
 * runs synchronously within the webhook window and writes directly to
 * `deliverables` rather than going through the queue — this keeps provisioning
 * self-contained and observable.
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars are not configured')
  return createClient(url, key)
}

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey: key })
}

interface ListingData {
  title?: string
  description?: string
  amenities?: string[]
  propertyType?: string
  location?: string
  pricePerNight?: number
  platform?: string
  voiceCalibration?: {
    tone?: string
    signOffName?: string
    alwaysUse?: string
    neverUse?: string
    personalityNotes?: string
  }
}

interface PropertyRow {
  id: string
  owner_user_id: string | null
  listing_data: ListingData | null
}

export async function queueListingCopyDeliverable(
  propertyId: string,
  ownerUserId: string | null
): Promise<void> {
  const supabase = getSupabase()

  // Idempotency — skip if a listing_copy provisioning deliverable already exists
  const { data: existing } = await supabase
    .from('deliverables')
    .select('id')
    .eq('property_id', propertyId)
    .eq('type', 'listing_copy')
    .eq('metadata->>trigger', 'checkout_provisioning')
    .maybeSingle()

  if (existing) {
    console.info(
      `[queueListingCopy] listing_copy deliverable already exists for property ${propertyId}, skipping`
    )
    return
  }

  // Fetch property listing data
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, owner_user_id, listing_data')
    .eq('id', propertyId)
    .single()

  if (propError || !property) {
    throw new Error(
      `queueListingCopy: property ${propertyId} not found — ${propError?.message ?? 'null'}`
    )
  }

  const prop = property as PropertyRow
  const listing: ListingData = prop.listing_data ?? {}

  if (!listing.title && !listing.description) {
    console.warn(
      `[queueListingCopy] Property ${propertyId} has no listing data, inserting placeholder deliverable`
    )
    await insertPlaceholderDeliverable(supabase, propertyId, ownerUserId ?? prop.owner_user_id)
    return
  }

  // Generate optimized listing copy
  const anthropic = getAnthropic()
  const content = await generateListingCopy(anthropic, listing)

  await supabase.from('deliverables').insert({
    property_id: propertyId,
    owner_user_id: ownerUserId ?? prop.owner_user_id,
    type: 'listing_copy',
    status: 'pending',
    content,
    metadata: {
      original_title: listing.title ?? null,
      platform: listing.platform ?? 'airbnb',
      generated_at: new Date().toISOString(),
      trigger: 'checkout_provisioning',
    },
    created_at: new Date().toISOString(),
  })

  console.info(`[queueListingCopy] listing_copy deliverable created for property ${propertyId}`)
}

async function generateListingCopy(anthropic: Anthropic, listing: ListingData): Promise<string> {
  const amenitiesList =
    listing.amenities && listing.amenities.length > 0
      ? listing.amenities.slice(0, 20).join(', ')
      : 'Not specified'

  const voice = listing.voiceCalibration ?? {}

  const prompt = `You are an expert Airbnb listing copywriter. Rewrite this short-term rental listing to maximize bookings and Airbnb search ranking.

Current listing:
Title: ${listing.title ?? 'No title provided'}
Description: ${listing.description ?? 'No description provided'}
Property type: ${listing.propertyType ?? 'Not specified'}
Location: ${listing.location ?? 'Not specified'}
Price: $${listing.pricePerNight ?? '?'}/night
Amenities: ${amenitiesList}

${voice.tone ? `Host voice/tone: ${voice.tone}` : ''}
${voice.alwaysUse ? `Always include: ${voice.alwaysUse}` : ''}
${voice.neverUse ? `Never say: ${voice.neverUse}` : ''}

Write an optimized listing with:
1. A compelling title (max 50 characters) that includes the property type, a key feature, and the location
2. An opening paragraph that hooks the reader in the first sentence
3. 3-4 short paragraphs covering the space, the experience, and local highlights
4. A closing call to action

Format your response as:

TITLE: [optimized title]

DESCRIPTION:
[full optimized description]

Focus on sensory details, emotional benefits, and searchable keywords. Keep the total description under 500 words.`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected non-text response from Claude')
  }

  return block.text.trim()
}

async function insertPlaceholderDeliverable(
  supabase: ReturnType<typeof getSupabase>,
  propertyId: string,
  ownerUserId: string | null
): Promise<void> {
  await supabase.from('deliverables').insert({
    property_id: propertyId,
    owner_user_id: ownerUserId,
    type: 'listing_copy',
    status: 'pending',
    content:
      'Your listing copy optimization is queued. The swarm will analyze your listing and deliver optimized copy within 24 hours.',
    metadata: {
      trigger: 'checkout_provisioning',
      placeholder: true,
      generated_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  })
}
