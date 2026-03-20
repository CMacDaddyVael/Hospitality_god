import Anthropic from '@anthropic-ai/sdk'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListingData {
  /** Airbnb/Vrbo listing title */
  title: string
  /** Property nickname or short name */
  propertyName?: string
  /** City, state or neighborhood */
  location: string
  /** "apartment", "house", "cabin", "condo", etc. */
  propertyType: string
  /** Stated check-in time, e.g. "3:00 PM" */
  checkInTime?: string
  /** Stated check-out time, e.g. "11:00 AM" */
  checkOutTime?: string
  /** Full list of amenities scraped from listing */
  amenities: string[]
  /** WiFi network name if known */
  wifiName?: string
  /** WiFi password if known */
  wifiPassword?: string
  /** Parking notes */
  parking?: string
  /** Full listing description */
  description?: string
  /** Host/owner first name */
  hostName?: string
  /** Direct contact number if provided */
  hostPhone?: string
  /** City-level or neighborhood-level location for local tips */
  localArea?: string
}

export interface OwnerVoiceProfile {
  /**
   * Overall tone descriptor — drives how Claude writes.
   * Examples: "warm and casual", "professional and concise",
   *           "luxury and refined", "fun and playful"
   */
  tone: string
  /** Name or sign-off the owner uses: "Sarah", "The Johnsons", "Your host, Mike" */
  signOffName: string
  /** Words/phrases the owner always uses */
  alwaysUse?: string
  /** Words/phrases the owner never uses */
  neverUse?: string
  /** Extra personality notes gleaned from reviews or onboarding */
  personalityNotes?: string
}

export interface GuestTemplate {
  /** Unique key identifier */
  id: string
  /** Human-readable template name shown in dashboard */
  name: string
  /** The message body — ready to copy-paste */
  body: string
  /** When to send this message relative to the stay */
  suggested_send_timing: string
  /** Always true — surfaces edit button in dashboard */
  editable: true
}

export interface TemplateDeliverable {
  /** Supabase deliverable id after save */
  deliverable_id?: string
  /** ISO timestamp */
  generated_at: string
  templates: GuestTemplate[]
}

// ─── Template IDs (ordered as they appear in the stay lifecycle) ──────────────

const TEMPLATE_IDS = [
  'booking_confirmation',
  'pre_arrival',
  'checkin_day_welcome',
  'mid_stay_checkin',
  'checkout_reminder',
  'post_checkout_thank_you',
  'five_star_review_request',
  'issue_complaint_response',
] as const

type TemplateId = (typeof TEMPLATE_IDS)[number]

const TEMPLATE_META: Record<TemplateId, { name: string; suggested_send_timing: string }> = {
  booking_confirmation: {
    name: 'Booking Confirmation',
    suggested_send_timing: 'Immediately after booking is confirmed',
  },
  pre_arrival: {
    name: 'Pre-Arrival Instructions',
    suggested_send_timing: '3–5 days before check-in',
  },
  checkin_day_welcome: {
    name: 'Check-In Day Welcome',
    suggested_send_timing: 'Morning of check-in day',
  },
  mid_stay_checkin: {
    name: 'Mid-Stay Check-In',
    suggested_send_timing: 'Day 2 or midpoint of stay (whichever comes first)',
  },
  checkout_reminder: {
    name: 'Checkout Reminder',
    suggested_send_timing: 'Evening before checkout day',
  },
  post_checkout_thank_you: {
    name: 'Post-Checkout Thank You',
    suggested_send_timing: 'Within 1–2 hours after checkout time',
  },
  five_star_review_request: {
    name: '5-Star Review Request',
    suggested_send_timing: '24–48 hours after checkout',
  },
  issue_complaint_response: {
    name: 'Issue / Complaint Response',
    suggested_send_timing: 'Within 1 hour of receiving a complaint',
  },
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildListingContext(listing: ListingData): string {
  const lines: string[] = []

  lines.push(`Property Name: ${listing.propertyName || listing.title}`)
  lines.push(`Type: ${listing.propertyType}`)
  lines.push(`Location: ${listing.location}`)

  if (listing.checkInTime) lines.push(`Check-In Time: ${listing.checkInTime}`)
  if (listing.checkOutTime) lines.push(`Check-Out Time: ${listing.checkOutTime}`)
  if (listing.hostName) lines.push(`Host Name: ${listing.hostName}`)

  // WiFi — only if present in amenities or explicitly provided
  const hasWifi =
    listing.wifiName ||
    listing.amenities.some((a) => /wifi|wi-fi|internet/i.test(a))
  if (hasWifi) {
    const wifiLine = listing.wifiName
      ? `WiFi Network: ${listing.wifiName}${listing.wifiPassword ? ` / Password: ${listing.wifiPassword}` : ''}`
      : 'WiFi: Available (owner to fill in network name and password)'
    lines.push(wifiLine)
  }

  if (listing.parking) lines.push(`Parking: ${listing.parking}`)
  if (listing.localArea) lines.push(`Local Area: ${listing.localArea}`)

  if (listing.amenities.length > 0) {
    // Cap at 20 amenities so the prompt doesn't balloon
    const amenityList = listing.amenities.slice(0, 20).join(', ')
    lines.push(`Key Amenities: ${amenityList}`)
  }

  return lines.join('\n')
}

function buildVoiceContext(voice: OwnerVoiceProfile): string {
  const lines: string[] = []
  lines.push(`Tone: ${voice.tone}`)
  lines.push(`Sign-off / name: ${voice.signOffName}`)
  if (voice.alwaysUse) lines.push(`Always use: ${voice.alwaysUse}`)
  if (voice.neverUse) lines.push(`Never use: ${voice.neverUse}`)
  if (voice.personalityNotes) lines.push(`Personality notes: ${voice.personalityNotes}`)
  return lines.join('\n')
}

function buildPrompt(listing: ListingData, voice: OwnerVoiceProfile): string {
  return `You are an expert short-term rental copywriter. Your job is to write 8 guest communication templates in the host's authentic voice.

## PROPERTY DETAILS
${buildListingContext(listing)}

## HOST VOICE PROFILE
${buildVoiceContext(voice)}

## INSTRUCTIONS
- Write every template in the host's exact voice and tone described above.
- The tone difference between a "warm and casual" host and a "professional and concise" host must be clearly audible — different word choices, sentence length, emoji usage, formality level.
- Reference actual property-specific details (property name, check-in time, checkout time, WiFi info if available) rather than generic placeholders. Where you don't have a specific detail, use a sensible bracketed placeholder like [door code] or [parking spot number].
- Each message should feel like it was personally written by this specific host — not a generic Airbnb template.
- Keep messages appropriately concise for mobile reading. Booking confirmation and pre-arrival can be longer; mid-stay check-in and review requests should be brief.
- Do NOT use the phrase "I hope this message finds you well" or other generic openers.

## TEMPLATES TO WRITE
Write all 8 templates in order. For each template, output ONLY valid JSON in this exact structure (no markdown, no explanations, just the JSON array):

[
  {
    "id": "booking_confirmation",
    "body": "..."
  },
  {
    "id": "pre_arrival",
    "body": "..."
  },
  {
    "id": "checkin_day_welcome",
    "body": "..."
  },
  {
    "id": "mid_stay_checkin",
    "body": "..."
  },
  {
    "id": "checkout_reminder",
    "body": "..."
  },
  {
    "id": "post_checkout_thank_you",
    "body": "..."
  },
  {
    "id": "five_star_review_request",
    "body": "..."
  },
  {
    "id": "issue_complaint_response",
    "body": "..."
  }
]

CRITICAL: Output ONLY the JSON array. No preamble. No explanation. No markdown code fences. The first character of your response must be "[" and the last must be "]".`
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Generate 8 guest communication templates in the owner's voice.
 *
 * All 8 templates are produced in a single Claude API call for efficiency.
 * Returns a TemplateDeliverable ready to be stored in Supabase.
 */
export async function generateGuestTemplates(
  listing: ListingData,
  voiceProfile: OwnerVoiceProfile,
): Promise<TemplateDeliverable> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }

  const client = new Anthropic({ apiKey })

  const prompt = buildPrompt(listing, voiceProfile)

  let rawResponse: string

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text content from the response
    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content')
    }
    rawResponse = textBlock.text.trim()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude API call failed: ${message}`)
  }

  // Parse the JSON response
  let parsedBodies: Array<{ id: string; body: string }>

  try {
    // Strip any accidental code fences in case Claude adds them
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    parsedBodies = JSON.parse(cleaned)

    if (!Array.isArray(parsedBodies)) {
      throw new Error('Response is not an array')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to parse Claude response as JSON: ${message}\n\nRaw response:\n${rawResponse.slice(0, 500)}`,
    )
  }

  // Validate we got all 8 templates
  const receivedIds = new Set(parsedBodies.map((t) => t.id))
  const missingIds = TEMPLATE_IDS.filter((id) => !receivedIds.has(id))
  if (missingIds.length > 0) {
    throw new Error(`Missing templates in Claude response: ${missingIds.join(', ')}`)
  }

  // Build the final structured deliverable
  const templates: GuestTemplate[] = TEMPLATE_IDS.map((id) => {
    const parsed = parsedBodies.find((t) => t.id === id)!
    const meta = TEMPLATE_META[id]

    return {
      id,
      name: meta.name,
      body: parsed.body,
      suggested_send_timing: meta.suggested_send_timing,
      editable: true,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    templates,
  }
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

export interface SaveDeliverableOptions {
  /** Supabase client instance */
  supabase: import('@supabase/supabase-js').SupabaseClient
  /** The owner/user id */
  userId: string
  /** The listing id this deliverable belongs to */
  listingId: string
  /** The generated deliverable to save */
  deliverable: TemplateDeliverable
}

/**
 * Save the template deliverable to Supabase.
 *
 * Upserts so re-generating templates for the same listing replaces the old set.
 * Returns the deliverable_id assigned by the database.
 */
export async function saveGuestTemplatesDeliverable(
  opts: SaveDeliverableOptions,
): Promise<string> {
  const { supabase, userId, listingId, deliverable } = opts

  const payload = {
    templates: deliverable.templates,
    generated_at: deliverable.generated_at,
  }

  const { data, error } = await supabase
    .from('deliverables')
    .upsert(
      {
        user_id: userId,
        listing_id: listingId,
        type: 'guest_templates',
        status: 'pending_review',
        payload,
        created_at: deliverable.generated_at,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,listing_id,type',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to save deliverable to Supabase: ${error.message}`)
  }

  return data.id as string
}
