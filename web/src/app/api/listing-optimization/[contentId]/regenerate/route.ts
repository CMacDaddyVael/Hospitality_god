/**
 * POST /api/listing-optimization/[contentId]/regenerate
 *
 * Re-runs Claude for a single content item (title, description, or tags).
 * Rate-limited to MAX_REGENERATIONS_PER_DAY per item per day.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runListingOptimizationJob } from '../../../../../../lib/queue/workers/listing-optimization'
import type { ListingOptimizationJobPayload } from '../../../../../../lib/queue/workers/listing-optimization'
import { MAX_REGENERATIONS_PER_DAY } from '../../../../../../lib/queue/constants'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSeason(month: number): string {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

async function regenerateSingleItem(
  subtype: string,
  originalText: string,
  listingData: Record<string, unknown>
): Promise<string> {
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
  const currentSeason = getSeason(new Date().getMonth())
  const topAmenities =
    (listingData.amenities as string[] | undefined)?.slice(0, 10).join(', ') || 'not specified'

  let prompt = ''

  if (subtype === 'title') {
    prompt = `You are an expert Airbnb listing copywriter.

Original title: "${originalText}"
Property type: ${listingData.propertyType || 'vacation rental'}
Location: ${listingData.location || 'not specified'}
Amenities: ${topAmenities}

Write a NEW, improved Airbnb listing title. Rules:
- MUST be under 50 characters (count carefully)
- Must be compelling and searchable
- Return ONLY the title text, no quotes, no explanation`
  } else if (subtype === 'description') {
    prompt = `You are an expert Airbnb listing copywriter.

Original description: "${originalText}"
Property type: ${listingData.propertyType || 'vacation rental'}
Location: ${listingData.location || 'not specified'}
Amenities: ${topAmenities}
Current season: ${currentSeason} (${currentMonth})

Write a NEW, improved Airbnb listing description. Rules:
- Open with a seasonal hook for ${currentSeason}/${currentMonth}
- Foreground the top 3 most compelling amenities in the first paragraph
- Use short paragraphs for readability
- End with a clear call to action
- Aim for 150-250 words
- Return ONLY the description text, no explanation`
  } else if (subtype === 'tags') {
    prompt = `You are an expert Airbnb SEO specialist.

Property type: ${listingData.propertyType || 'vacation rental'}
Location: ${listingData.location || 'not specified'}
Amenities: ${topAmenities}

Generate exactly 10 NEW keyword/tag suggestions optimized for Airbnb search.
Return ONLY a JSON array of 10 strings, e.g.: ["tag one", "tag two", ...]
No explanation, no markdown, just the JSON array.`
  }

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  if (subtype === 'title') {
    return rawText.slice(0, 50).trimEnd()
  }

  if (subtype === 'tags') {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as string[]
      return parsed.slice(0, 10).join('\n')
    }
    // Fallback: split by newline
    return rawText.split('\n').slice(0, 10).join('\n')
  }

  return rawText
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  try {
    const { contentId } = params

    if (!contentId) {
      return NextResponse.json({ error: 'contentId is required' }, { status: 400 })
    }

    // Fetch the existing content item
    const { data: contentItem, error: fetchError } = await supabase
      .from('content')
      .select('*, properties(*)')
      .eq('id', contentId)
      .single()

    if (fetchError || !contentItem) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
    }

    // Don't regenerate approved items
    if (contentItem.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot regenerate an approved item. It has already been accepted.' },
        { status: 409 }
      )
    }

    // Check rate limit: count regenerations today
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { count: regenCount, error: countError } = await supabase
      .from('regeneration_log')
      .select('id', { count: 'exact', head: true })
      .eq('content_id', contentId)
      .gte('regenerated_at', startOfDay.toISOString())

    if (countError) {
      console.error('[regenerate] Count error:', countError)
      return NextResponse.json({ error: 'Failed to check rate limit' }, { status: 500 })
    }

    if ((regenCount ?? 0) >= MAX_REGENERATIONS_PER_DAY) {
      return NextResponse.json(
        {
          error: `Rate limit reached. You can regenerate this item up to ${MAX_REGENERATIONS_PER_DAY} times per day.`,
          limit: MAX_REGENERATIONS_PER_DAY,
          used: regenCount,
        },
        { status: 429 }
      )
    }

    // Mark as regenerating
    await supabase
      .from('content')
      .update({ status: 'regenerating' })
      .eq('id', contentId)

    // Get listing data from the property
    const listingData =
      contentItem.properties?.listing_data ||
      contentItem.metadata?.listingData ||
      {}

    // Re-run Claude for just this subtype
    const newAiText = await regenerateSingleItem(
      contentItem.subtype,
      contentItem.original_text || '',
      listingData
    )

    // Log the regeneration
    await supabase.from('regeneration_log').insert({
      content_id: contentId,
      user_id: contentItem.user_id,
    })

    // Update the content item
    const { data: updatedItem, error: updateError } = await supabase
      .from('content')
      .update({
        ai_text: newAiText,
        status: 'pending',
        regeneration_count: (contentItem.regeneration_count || 0) + 1,
        last_regenerated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single()

    if (updateError) {
      console.error('[regenerate] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update content item' }, { status: 500 })
    }

    const todayRegensUsed = (regenCount ?? 0) + 1
    return NextResponse.json({
      success: true,
      content: updatedItem,
      regenerationsUsedToday: todayRegensUsed,
      regenerationsRemainingToday: MAX_REGENERATIONS_PER_DAY - todayRegensUsed,
    })
  } catch (error) {
    console.error('[regenerate] Unexpected error:', error)
    // Reset status to pending on error
    if (params?.contentId) {
      await supabase
        .from('content')
        .update({ status: 'pending' })
        .eq('id', params.contentId)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
