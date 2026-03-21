import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ────────────────────────────────────────────────────────────────────

interface ListingData {
  title?: string
  description?: string
  propertyName?: string
  propertyType?: string
  location?: string
  amenities?: string[]
  bedrooms?: number
  bathrooms?: number
  maxGuests?: number
  pricePerNight?: number
  rating?: number
  reviewCount?: number
  uniqueSellingPoints?: string[]
  url?: string
}

interface AuditFlag {
  category: string
  issue: string
  severity: 'high' | 'medium' | 'low'
  recommendation?: string
}

interface OwnerVoice {
  tone?: 'casual' | 'professional' | 'warm' | 'luxury'
  signOffName?: string
  alwaysUse?: string
  neverUse?: string
  personalityNotes?: string
}

interface OptimizeRequest {
  listingData: ListingData
  auditFlags: AuditFlag[]
  ownerVoice?: OwnerVoice
  ownerId?: string
  listingId?: string
}

interface OptimizeResult {
  optimizedTitle: string
  optimizedDescription: string
  suggestedTags: string[]
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an expert Airbnb listing copywriter and SEO specialist with deep knowledge of Airbnb's 2025 ranking algorithm. You create compelling, conversion-optimized listing content that ranks well and drives bookings.

## Airbnb 2025 Ranking Signals You Must Optimize For
- **Keyword relevance**: Use high-search-volume terms guests actually type (location + property type + amenity combos)
- **Guest experience signals**: Highlight unique amenities, proximity to attractions, and experiential benefits
- **Trust signals**: Weave in review-backed claims where supported by data
- **Specificity over vagueness**: Concrete details ("5-min walk to beach") outperform generic claims ("near the water")
- **Amenity completeness**: Name specific amenities — algorithms surface listings that match search filters
- **First-line hook**: Airbnb truncates descriptions; the opening 2 sentences must grab attention and contain primary keywords
- **Scannability**: Use short paragraphs (2-3 sentences max), varied sentence length, and natural paragraph breaks
- **Emotional resonance**: Connect features to guest feelings and experiences, not just specs

## Title Rules (CRITICAL — ENFORCED)
- MAXIMUM 50 characters — this is a hard limit enforced by the system
- Front-load the most important keyword (property type or standout feature)
- Include location or unique selling point if space allows
- Use title case
- No filler words ("Amazing", "Stunning", "Perfect") — be specific and descriptive
- Count every character including spaces before submitting

## Description Requirements
- 500–800 words total
- Opening hook (2-3 sentences): property name + #1 selling point + emotional payoff
- Body sections: The Space, Guest Experience, Location & Nearby, House Notes
- Naturally incorporate the top audit flag fixes as improvements
- Match the owner's voice/tone profile
- End with a clear call-to-action ("Book [Property Name] for your [season] getaway")
- Do NOT use markdown headers or bullet points — write in flowing paragraphs
- Preserve the owner's property name exactly as given

## Tag/Amenity List Rules
- Output 15–20 specific, searchable tags
- Mix: amenity tags, experience tags, guest-type tags, location tags
- Use exact Airbnb amenity filter language where possible (e.g., "Hot tub", "Free parking", "Beachfront")
- Prioritize tags that match common Airbnb search filters

## Output Format
Respond ONLY with valid JSON in this exact structure — no preamble, no explanation:
{
  "optimizedTitle": "string (≤50 chars)",
  "optimizedDescription": "string (500-800 words, plain text paragraphs)",
  "suggestedTags": ["tag1", "tag2", ...]
}`
}

// ── User Prompt Builder ───────────────────────────────────────────────────────

function buildUserPrompt(
  listingData: ListingData,
  auditFlags: AuditFlag[],
  ownerVoice?: OwnerVoice
): string {
  const topFlags = auditFlags
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.severity] - order[b.severity]
    })
    .slice(0, 3)

  const voiceSection = ownerVoice
    ? `
## Owner Voice Profile
- Tone: ${ownerVoice.tone || 'warm'}
- Sign-off name: ${ownerVoice.signOffName || 'not specified'}
- Always use language like: ${ownerVoice.alwaysUse || 'not specified'}
- Never use: ${ownerVoice.neverUse || 'not specified'}
- Personality notes: ${ownerVoice.personalityNotes || 'none'}
`
    : ''

  const amenitiesSection =
    listingData.amenities && listingData.amenities.length > 0
      ? `\n## Current Amenities Listed\n${listingData.amenities.join(', ')}`
      : ''

  const uspSection =
    listingData.uniqueSellingPoints && listingData.uniqueSellingPoints.length > 0
      ? `\n## Owner-Identified Unique Selling Points\n${listingData.uniqueSellingPoints.join('\n- ')}`
      : ''

  return `## Listing Data to Rewrite

**Property Name:** ${listingData.propertyName || listingData.title || 'Not specified'}
**Current Title:** ${listingData.title || 'Not provided'}
**Property Type:** ${listingData.propertyType || 'Not specified'}
**Location:** ${listingData.location || 'Not specified'}
**Bedrooms:** ${listingData.bedrooms ?? 'Not specified'}
**Bathrooms:** ${listingData.bathrooms ?? 'Not specified'}
**Max Guests:** ${listingData.maxGuests ?? 'Not specified'}
**Price Per Night:** ${listingData.pricePerNight ? `$${listingData.pricePerNight}` : 'Not specified'}
**Rating:** ${listingData.rating ? `${listingData.rating}/5` : 'Not specified'}
**Review Count:** ${listingData.reviewCount ?? 'Not specified'}

**Current Description:**
${listingData.description || 'No description provided — write one from scratch using the property data above.'}
${amenitiesSection}
${uspSection}
${voiceSection}
## Top 3 Audit Flags to Fix (incorporate these fixes explicitly)
${
  topFlags.length > 0
    ? topFlags
        .map(
          (flag, i) =>
            `${i + 1}. [${flag.severity.toUpperCase()}] ${flag.category}: ${flag.issue}${
              flag.recommendation ? ` → Fix: ${flag.recommendation}` : ''
            }`
        )
        .join('\n')
    : 'No audit flags provided — optimize based on best practices.'
}

Now generate the optimized listing content. Remember: title MUST be ≤ 50 characters. Description must be 500–800 words in plain paragraphs. Output valid JSON only.`
}

// ── Claude Call ───────────────────────────────────────────────────────────────

async function callClaude(
  listingData: ListingData,
  auditFlags: AuditFlag[],
  ownerVoice?: OwnerVoice
): Promise<OptimizeResult> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(listingData, auditFlags, ownerVoice),
      },
    ],
  })

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  // Strip any markdown code fences if Claude adds them
  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  const parsed = JSON.parse(jsonText) as OptimizeResult

  if (
    !parsed.optimizedTitle ||
    !parsed.optimizedDescription ||
    !Array.isArray(parsed.suggestedTags)
  ) {
    throw new Error('Claude returned malformed JSON — missing required fields')
  }

  return parsed
}

// ── Title Validation & Re-prompt ──────────────────────────────────────────────

async function callClaudeWithTitleRetry(
  listingData: ListingData,
  auditFlags: AuditFlag[],
  ownerVoice?: OwnerVoice
): Promise<OptimizeResult> {
  const result = await callClaude(listingData, auditFlags, ownerVoice)

  // Validate title length
  if (result.optimizedTitle.length <= 50) {
    return result
  }

  // Title is over limit — re-prompt once with explicit constraint
  console.warn(
    `[optimize/listing] Title too long (${result.optimizedTitle.length} chars): "${result.optimizedTitle}" — re-prompting`
  )

  const retryResponse = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 256,
    system: `You are an expert Airbnb listing copywriter. You write titles that are STRICTLY under 50 characters.`,
    messages: [
      {
        role: 'user',
        content: `This Airbnb listing title is ${result.optimizedTitle.length} characters long, which exceeds the 50-character maximum:

"${result.optimizedTitle}"

Property: ${listingData.propertyName || listingData.title || 'vacation rental'}
Location: ${listingData.location || ''}
Type: ${listingData.propertyType || ''}

Rewrite it to be ≤ 50 characters while keeping it keyword-rich and compelling. 
Count every character including spaces.
Respond with ONLY the new title — no quotes, no explanation.`,
      },
    ],
  })

  const newTitle = retryResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim()
    .replace(/^["']|["']$/g, '') // strip any surrounding quotes

  if (newTitle.length > 50) {
    // Hard truncate as last resort — preserve word boundaries
    const truncated = newTitle.slice(0, 50).replace(/\s+\S*$/, '').trim()
    console.warn(
      `[optimize/listing] Retry title still too long — hard truncating to: "${truncated}"`
    )
    return { ...result, optimizedTitle: truncated }
  }

  return { ...result, optimizedTitle: newTitle }
}

// ── Supabase Storage ──────────────────────────────────────────────────────────

async function storeDeliverable(
  ownerId: string | undefined,
  listingId: string | undefined,
  result: OptimizeResult,
  inputSummary: { listingTitle?: string; location?: string; flagCount: number }
): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[optimize/listing] Supabase not configured — skipping deliverable storage')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('deliverables')
      .insert({
        owner_id: ownerId ?? null,
        listing_id: listingId ?? null,
        type: 'listing_optimization',
        status: 'pending_review',
        content: {
          optimizedTitle: result.optimizedTitle,
          optimizedDescription: result.optimizedDescription,
          suggestedTags: result.suggestedTags,
        },
        metadata: {
          originalTitle: inputSummary.listingTitle,
          location: inputSummary.location,
          auditFlagsAddressed: inputSummary.flagCount,
          generatedAt: new Date().toISOString(),
          titleCharCount: result.optimizedTitle.length,
          descriptionWordCount: result.optimizedDescription
            .split(/\s+/)
            .filter(Boolean).length,
          tagCount: result.suggestedTags.length,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[optimize/listing] Supabase insert error:', error)
      return null
    }

    return data?.id ?? null
  } catch (err) {
    console.error('[optimize/listing] Failed to store deliverable:', err)
    return null
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OptimizeRequest

    // Validate required fields
    if (!body.listingData) {
      return NextResponse.json(
        { error: 'listingData is required' },
        { status: 400 }
      )
    }

    if (!body.auditFlags || !Array.isArray(body.auditFlags)) {
      return NextResponse.json(
        { error: 'auditFlags must be an array' },
        { status: 400 }
      )
    }

    const { listingData, auditFlags, ownerVoice, ownerId, listingId } = body

    // Generate optimized content via Claude (with title retry logic)
    const result = await callClaudeWithTitleRetry(listingData, auditFlags, ownerVoice)

    // Validate final title length
    if (result.optimizedTitle.length > 50) {
      return NextResponse.json(
        {
          error: 'Could not generate a title within the 50-character limit after retry',
          titleLength: result.optimizedTitle.length,
        },
        { status: 422 }
      )
    }

    // Store as deliverable in Supabase
    const deliverableId = await storeDeliverable(ownerId, listingId, result, {
      listingTitle: listingData.title,
      location: listingData.location,
      flagCount: Math.min(auditFlags.length, 3),
    })

    return NextResponse.json({
      success: true,
      optimizedTitle: result.optimizedTitle,
      optimizedDescription: result.optimizedDescription,
      suggestedTags: result.suggestedTags,
      deliverableId,
      meta: {
        titleCharCount: result.optimizedTitle.length,
        descriptionWordCount: result.optimizedDescription
          .split(/\s+/)
          .filter(Boolean).length,
        tagCount: result.suggestedTags.length,
        auditFlagsAddressed: Math.min(auditFlags.length, 3),
      },
    })
  } catch (err) {
    const error = err as Error

    // JSON parse errors from Claude response
    if (error.message?.includes('JSON')) {
      console.error('[optimize/listing] Failed to parse Claude response:', error)
      return NextResponse.json(
        { error: 'AI returned an unexpected response format. Please try again.' },
        { status: 502 }
      )
    }

    console.error('[optimize/listing] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to optimize listing. Please try again.' },
      { status: 500 }
    )
  }
}
