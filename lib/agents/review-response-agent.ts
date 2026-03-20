import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListingReview {
  id: string
  listing_id: string
  reviewer_name: string | null
  review_text: string
  rating: number
  review_date: string | null
  responded_at: string | null
  platform: string | null
}

interface OwnerProfile {
  id: string
  user_id: string
  tone: string | null
  sign_off_name: string | null
  always_use: string | null
  never_use: string | null
  personality_notes: string | null
  raw_voice_sample: string | null
}

interface Listing {
  id: string
  user_id: string
  title: string | null
  property_type: string | null
  location: string | null
  platform: string | null
}

interface GenerateResult {
  success: boolean
  generated: number
  skipped: number
  errors: string[]
  deliverable_ids: string[]
}

// ─── Supabase client (lazy, uses env vars) ────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.'
    )
  }

  return createClient(url, key)
}

// ─── Anthropic client (lazy) ──────────────────────────────────────────────────

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY env var.')
  }
  return new Anthropic({ apiKey })
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(ownerProfile: OwnerProfile | null): string {
  if (!ownerProfile) {
    return [
      'You are a warm, professional short-term rental host writing a response to a guest review.',
      'Your tone is genuine, appreciative, and human — not corporate or robotic.',
      'You care deeply about your guests\' experience and it shows in how you write.',
      'Keep responses under 150 words.',
      'Do not use hollow filler phrases like "We appreciate your feedback" or "Your satisfaction is our priority."',
      'Sound like a real person, not a customer service script.',
    ].join('\n')
  }

  const toneMap: Record<string, string> = {
    casual: 'conversational and relaxed — like a friend texting back',
    professional: 'polished and professional, but still warm and approachable',
    warm: 'deeply warm, personal, and heartfelt',
    luxury: 'refined, gracious, and subtly elegant',
  }

  const toneDescription = toneMap[ownerProfile.tone || 'warm'] || toneMap['warm']

  const lines = [
    `You are writing a review response on behalf of ${ownerProfile.sign_off_name || 'the host'}, a short-term rental host.`,
    `Your tone is ${toneDescription}.`,
    'Keep responses under 150 words.',
    'Sound genuinely human — not corporate or scripted.',
  ]

  if (ownerProfile.always_use) {
    lines.push(`ALWAYS include or reflect: ${ownerProfile.always_use}`)
  }

  if (ownerProfile.never_use) {
    lines.push(`NEVER use or reference: ${ownerProfile.never_use}`)
  }

  if (ownerProfile.personality_notes) {
    lines.push(`Host personality context: ${ownerProfile.personality_notes}`)
  }

  if (ownerProfile.raw_voice_sample) {
    lines.push(
      'Here is a sample of how this host actually writes. Mirror this voice closely:',
      `---`,
      ownerProfile.raw_voice_sample.slice(0, 600),
      `---`
    )
  }

  return lines.join('\n')
}

function buildUserPrompt(
  review: ListingReview,
  listing: Listing,
  hasVoiceProfile: boolean
): string {
  const propertyName = listing.title || 'the property'
  const propertyType = listing.property_type || 'short-term rental'
  const stars = review.rating
  const reviewText = review.review_text.trim()
  const reviewerName = review.reviewer_name || 'the guest'

  let toneGuidance: string
  if (stars === 5) {
    toneGuidance =
      'This is a glowing 5-star review. Write a warm, genuine thank-you response. Express real appreciation, mention something specific from their review if possible, and invite them back.'
  } else if (stars === 4) {
    toneGuidance =
      'This is a positive 4-star review. Acknowledge their kind words genuinely, and if they mentioned anything that could have been better, address it briefly and graciously without being defensive.'
  } else if (stars === 3) {
    toneGuidance =
      'This is a mixed 3-star review. Thank them for staying, acknowledge their specific concerns directly and honestly, explain any relevant context without making excuses, and show what you\'re doing to improve.'
  } else {
    toneGuidance =
      `This is a critical ${stars}-star review. Thank them for taking the time to share feedback. Address each concern specifically and honestly. Be gracious, not defensive. Show genuine accountability and any corrective actions taken or planned. Future guests will read this — demonstrate that you take quality seriously.`
  }

  const lines = [
    `Property: "${propertyName}" (${propertyType})`,
    `Reviewer: ${reviewerName}`,
    `Star rating: ${stars}/5`,
    '',
    `Guest's review:`,
    `"${reviewText}"`,
    '',
    toneGuidance,
    '',
    'Write ONLY the response text — no labels, no preamble, no "Here is a response:" intro.',
    'Keep it under 150 words.',
    'End with a natural sign-off that matches the host\'s tone.',
  ]

  if (!hasVoiceProfile) {
    lines.push(
      '',
      '(Use a generic warm STR host persona since no custom voice profile is available.)'
    )
  }

  return lines.join('\n')
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Fetches unresponded reviews for a listing and generates owner-voiced
 * response drafts stored as `pending_approval` deliverables.
 *
 * Called by the generation queue scheduler when `job_type = 'review_responses'`.
 *
 * @param listingId  UUID of the listing in the `listings` table
 * @param userId     UUID of the owner/subscriber
 */
export async function generateReviewResponses(
  listingId: string,
  userId: string
): Promise<GenerateResult> {
  const supabase = getSupabase()
  const anthropic = getAnthropic()

  const result: GenerateResult = {
    success: false,
    generated: 0,
    skipped: 0,
    errors: [],
    deliverable_ids: [],
  }

  // ── 1. Fetch listing metadata ──────────────────────────────────────────────
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, user_id, title, property_type, location, platform')
    .eq('id', listingId)
    .eq('user_id', userId)
    .single()

  if (listingError || !listing) {
    result.errors.push(
      `Listing not found or access denied: listingId=${listingId}, userId=${userId}. ${listingError?.message ?? ''}`
    )
    return result
  }

  // ── 2. Fetch unresponded reviews ───────────────────────────────────────────
  const { data: reviews, error: reviewsError } = await supabase
    .from('listing_reviews')
    .select(
      'id, listing_id, reviewer_name, review_text, rating, review_date, responded_at, platform'
    )
    .eq('listing_id', listingId)
    .is('responded_at', null)
    .order('review_date', { ascending: false })

  if (reviewsError) {
    result.errors.push(`Failed to fetch reviews: ${reviewsError.message}`)
    return result
  }

  if (!reviews || reviews.length === 0) {
    // No unresponded reviews — not an error, just nothing to generate
    result.success = true
    return result
  }

  // ── 3. Skip reviews that already have a pending deliverable ───────────────
  const reviewIds = reviews.map((r: ListingReview) => r.id)

  const { data: existingDeliverables } = await supabase
    .from('deliverables')
    .select('source_review_id')
    .eq('listing_id', listingId)
    .eq('type', 'review_response')
    .eq('status', 'pending_approval')
    .in('source_review_id', reviewIds)

  const alreadyQueued = new Set<string>(
    (existingDeliverables ?? [])
      .map((d: { source_review_id: string | null }) => d.source_review_id)
      .filter((id): id is string => !!id)
  )

  // ── 4. Fetch owner voice profile (optional) ────────────────────────────────
  const { data: ownerProfile } = await supabase
    .from('owner_profiles')
    .select(
      'id, user_id, tone, sign_off_name, always_use, never_use, personality_notes, raw_voice_sample'
    )
    .eq('user_id', userId)
    .single()

  const hasVoiceProfile = !!ownerProfile

  // ── 5. Process each unresponded review ────────────────────────────────────
  for (const review of reviews as ListingReview[]) {
    // Skip if a pending draft already exists for this review
    if (alreadyQueued.has(review.id)) {
      result.skipped++
      continue
    }

    // Skip reviews with no text
    if (!review.review_text || review.review_text.trim().length === 0) {
      result.skipped++
      continue
    }

    try {
      const systemPrompt = buildSystemPrompt(ownerProfile ?? null)
      const userPrompt = buildUserPrompt(review, listing as Listing, hasVoiceProfile)

      // ── 5a. Call Claude ──────────────────────────────────────────────────
      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 350,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text.trim() : ''

      if (!responseText) {
        result.errors.push(`Claude returned empty content for review ${review.id}`)
        continue
      }

      // ── 5b. Append voice profile nudge if no profile exists ───────────
      let finalContent = responseText
      if (!hasVoiceProfile) {
        finalContent +=
          '\n\n---\n💡 *Add your voice profile to personalize future responses.*'
      }

      // ── 5c. Insert deliverable ─────────────────────────────────────────
      const { data: deliverable, error: insertError } = await supabase
        .from('deliverables')
        .insert({
          listing_id: listingId,
          user_id: userId,
          type: 'review_response',
          status: 'pending_approval',
          content: finalContent,
          source_review_id: review.id,
          metadata: {
            reviewer_name: review.reviewer_name ?? null,
            rating: review.rating,
            review_date: review.review_date ?? null,
            review_text: review.review_text,
            platform: review.platform ?? listing.platform ?? null,
            voice_profile_used: hasVoiceProfile,
            generated_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single()

      if (insertError) {
        result.errors.push(
          `Failed to save deliverable for review ${review.id}: ${insertError.message}`
        )
        continue
      }

      result.deliverable_ids.push(deliverable.id)
      result.generated++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Unexpected error on review ${review.id}: ${msg}`)
    }
  }

  // Success if we generated at least something, or there were no errors at all
  result.success = result.generated > 0 || result.errors.length === 0
  return result
}
