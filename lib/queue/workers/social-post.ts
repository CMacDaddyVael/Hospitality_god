import type { Job } from '../types'
import { generateLifestyleImage, buildImagePrompt } from '../../src/lib/vael'
import type { ListingScrapeResult } from '../../src/lib/vael'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialPostJobData {
  propertyId: string
  userId: string
  listing: ListingScrapeResult & {
    title?: string
    url?: string
  }
  postType?: 'interior' | 'exterior' | 'lifestyle'
  weekNumber?: number
  platform?: 'instagram' | 'facebook' | 'tiktok'
}

interface SocialPostDeliverable {
  type: 'social_post'
  platform: string
  caption: string
  hashtags: string[]
  imageUrl?: string
  imageStatus: 'success' | 'failed' | 'pending'
  imageError?: string
  weekNumber: number
  generatedAt: string
  propertyId: string
}

// ─── Caption generator ────────────────────────────────────────────────────────

/**
 * Generates caption + hashtags using Claude.
 * Falls back to a templated caption if Claude is unavailable.
 */
async function generateCaption(listing: ListingScrapeResult & { title?: string }): Promise<{
  caption: string
  hashtags: string[]
}> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const location = listing.location ?? 'a beautiful destination'
  const propType = listing.propertyType ?? 'vacation rental'
  const title = listing.title ?? `${propType} in ${location}`

  const prompt = `You are a social media copywriter for a vacation rental property. 
Write a compelling Instagram caption and hashtag set for this property.

Property: ${title}
Type: ${propType}
Location: ${location}
${listing.amenities?.length ? `Highlights: ${listing.amenities.slice(0, 5).join(', ')}` : ''}
${listing.description ? `Description: ${listing.description.slice(0, 300)}` : ''}

Requirements:
- Caption: 2-3 sentences, warm and aspirational tone, ends with a call to action or question
- Hashtags: 15-20 relevant hashtags (mix of broad travel tags and niche STR-specific tags)
- No emojis in the main caption body (add 1-2 at the end max)
- No generic filler phrases like "escape the hustle"

Respond with valid JSON only:
{
  "caption": "...",
  "hashtags": ["#tag1", "#tag2", ...]
}`

  try {
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      caption: parsed.caption ?? fallbackCaption(listing),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : fallbackHashtags(location),
    }
  } catch (err) {
    console.error('[social-post] Caption generation failed, using fallback:', err)
    return {
      caption: fallbackCaption(listing),
      hashtags: fallbackHashtags(location),
    }
  }
}

function fallbackCaption(listing: ListingScrapeResult & { title?: string }): string {
  const location = listing.location ?? 'a stunning destination'
  const propType = listing.propertyType ?? 'vacation rental'
  return `Imagine waking up here. Our ${propType} in ${location} is the escape you've been planning all year. Would you book it? 🌿`
}

function fallbackHashtags(location: string): string[] {
  const loc = location.toLowerCase().replace(/[^a-z0-9]/g, '')
  return [
    '#vacationrental',
    '#airbnb',
    '#travel',
    '#travelgram',
    '#vacay',
    '#getaway',
    '#explore',
    '#wanderlust',
    `#${loc}`,
    '#stayhere',
    '#holidayvibes',
    '#travelphotography',
    '#vacationmode',
    '#tripplanning',
    '#shorttermrental',
  ]
}

// ─── Determine post type from week number ─────────────────────────────────────

function resolvePostType(
  weekNumber: number,
  explicit?: 'interior' | 'exterior' | 'lifestyle'
): 'interior' | 'exterior' | 'lifestyle' {
  if (explicit) return explicit
  // Rotate through types on a 3-week cycle for variety
  const cycle = weekNumber % 3
  if (cycle === 0) return 'interior'
  if (cycle === 1) return 'exterior'
  return 'lifestyle'
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export async function processSocialPostJob(job: Job<SocialPostJobData>): Promise<void> {
  const { propertyId, userId, listing, postType: explicitPostType, platform = 'instagram' } =
    job.data

  const weekNumber =
    job.data.weekNumber ??
    Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))

  const postType = resolvePostType(weekNumber, explicitPostType)

  console.log(
    `[social-post] Starting job for property=${propertyId} week=${weekNumber} postType=${postType}`
  )

  // ── 1. Generate caption ───────────────────────────────────────────────────
  const { caption, hashtags } = await generateCaption(listing)

  // ── 2. Generate lifestyle image ───────────────────────────────────────────
  let imageUrl: string | undefined
  let imageStatus: 'success' | 'failed' = 'failed'
  let imageError: string | undefined

  try {
    const prompt = buildImagePrompt(listing, postType)
    console.log(`[social-post] Generating VAEL image for property=${propertyId}`)
    imageUrl = await generateLifestyleImage(prompt, listing, propertyId, postType)
    imageStatus = 'success'
    console.log(`[social-post] VAEL image generated: ${imageUrl}`)
  } catch (err) {
    imageError = err instanceof Error ? err.message : String(err)
    imageStatus = 'failed'
    console.error(
      `[social-post] VAEL image generation failed for property=${propertyId}:`,
      imageError
    )
    // We do NOT re-throw — the deliverable is still created with imageStatus: "failed"
  }

  // ── 3. Build deliverable ──────────────────────────────────────────────────
  const deliverable: SocialPostDeliverable = {
    type: 'social_post',
    platform,
    caption,
    hashtags,
    imageUrl,
    imageStatus,
    ...(imageError && { imageError }),
    weekNumber,
    generatedAt: new Date().toISOString(),
    propertyId,
  }

  // ── 4. Persist to Supabase ────────────────────────────────────────────────
  await saveDeliverable(userId, propertyId, deliverable)

  console.log(
    `[social-post] Deliverable saved for property=${propertyId} imageStatus=${imageStatus}`
  )
}

async function saveDeliverable(
  userId: string,
  propertyId: string,
  content: SocialPostDeliverable
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js')

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[social-post] Supabase not configured — deliverable not persisted')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { error } = await supabase.from('deliverables').insert({
    user_id: userId,
    property_id: propertyId,
    type: 'social_post',
    status: 'pending_review',
    content,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[social-post] Failed to save deliverable:', error.message)
    throw new Error(`Failed to save deliverable: ${error.message}`)
  }
}
