/**
 * generateReviewResponses
 *
 * Triggered immediately after a successful checkout to seed the new Pro
 * subscriber's dashboard with ready-to-use review response drafts.
 *
 * Pulls the owner's scraped reviews from the `properties` table, runs them
 * through the Claude review-response prompt, and writes the results to the
 * `deliverables` table so they appear in the dashboard on first login.
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

interface Review {
  text: string
  rating: number
  date?: string
}

interface PropertyRow {
  id: string
  owner_user_id: string | null
  listing_data: {
    reviews?: Review[]
    title?: string
    voiceCalibration?: {
      tone?: string
      signOffName?: string
      alwaysUse?: string
      neverUse?: string
      personalityNotes?: string
    }
  } | null
}

/**
 * Generate review responses for the N most recent reviews that don't already
 * have a deliverable.  Limited to 5 per invocation so the webhook stays fast.
 */
export async function generateReviewResponses(propertyId: string): Promise<void> {
  const supabase = getSupabase()

  // ── Fetch property ──────────────────────────────────────────────────────
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, owner_user_id, listing_data')
    .eq('id', propertyId)
    .single()

  if (propError || !property) {
    throw new Error(
      `generateReviewResponses: property ${propertyId} not found — ${propError?.message ?? 'null'}`
    )
  }

  const prop = property as PropertyRow
  const reviews: Review[] = prop.listing_data?.reviews ?? []

  if (reviews.length === 0) {
    console.info(`[generateReviewResponses] No reviews found for property ${propertyId}, skipping`)
    return
  }

  // Check which reviews already have deliverables to stay idempotent
  const { data: existingDeliverables } = await supabase
    .from('deliverables')
    .select('metadata')
    .eq('property_id', propertyId)
    .eq('type', 'review_response')

  const handledDates = new Set<string>(
    (existingDeliverables ?? [])
      .map((d: { metadata?: { review_date?: string } }) => d.metadata?.review_date)
      .filter(Boolean) as string[]
  )

  // Pick up to 5 unhandled reviews, most recent first
  const pending = reviews
    .filter((r) => !r.date || !handledDates.has(r.date))
    .slice(-5)
    .reverse()

  if (pending.length === 0) {
    console.info(
      `[generateReviewResponses] All reviews already have deliverables for property ${propertyId}`
    )
    return
  }

  const anthropic = getAnthropic()
  const voice = prop.listing_data?.voiceCalibration ?? {}
  const listingTitle = prop.listing_data?.title ?? 'our property'

  for (const review of pending) {
    const responseText = await generateSingleResponse(anthropic, review, voice, listingTitle)

    await supabase.from('deliverables').insert({
      property_id: propertyId,
      owner_user_id: prop.owner_user_id,
      type: 'review_response',
      status: 'pending',
      content: responseText,
      metadata: {
        review_text: review.text,
        review_rating: review.rating,
        review_date: review.date ?? null,
        generated_at: new Date().toISOString(),
        trigger: 'checkout_provisioning',
      },
      created_at: new Date().toISOString(),
    })

    console.info(
      `[generateReviewResponses] Saved review response deliverable for property ${propertyId}`
    )
  }
}

async function generateSingleResponse(
  anthropic: Anthropic,
  review: Review,
  voice: {
    tone?: string
    signOffName?: string
    alwaysUse?: string
    neverUse?: string
    personalityNotes?: string
  },
  listingTitle: string
): Promise<string> {
  const toneDescription = voice.tone ?? 'warm and professional'
  const signOff = voice.signOffName ? `Sign off as: ${voice.signOffName}.` : ''
  const alwaysUse = voice.alwaysUse ? `Always include: ${voice.alwaysUse}.` : ''
  const neverUse = voice.neverUse ? `Never say: ${voice.neverUse}.` : ''
  const personality = voice.personalityNotes
    ? `Additional voice notes: ${voice.personalityNotes}.`
    : ''

  const prompt = `You are writing a host response to a guest review for "${listingTitle}".

Voice instructions:
- Tone: ${toneDescription}
${signOff}
${alwaysUse}
${neverUse}
${personality}

Guest review (${review.rating}/5 stars):
"${review.text}"

Write a thoughtful, genuine host response. Keep it under 150 words. Do not use generic filler phrases. Match the tone and voice described above. Output only the response text, no preamble.`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected non-text response from Claude')
  }

  return block.text.trim()
}
