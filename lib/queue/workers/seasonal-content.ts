/**
 * Seasonal Content Worker
 * Generates seasonal listing copy, social captions, and image briefs
 * for a given property.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { detectSeasonalContext } from '../../seasonal/detector.mjs'
import { buildSeasonalContentPrompt } from '../../ai/prompts/seasonal_content.mjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface SeasonalContentJobData {
  propertyId: string
  userId: string
  propertyTitle: string
  propertyDescription: string
  location: string
  propertyType: string
  amenities: string[]
  ownerTone?: string
  // Optional override for testing
  currentDate?: string
}

export interface SeasonalContentResult {
  success: boolean
  deliverableId?: string
  season?: string
  holiday?: string | null
  targetMonth?: string
  error?: string
}

/**
 * Generate seasonal content for a property and save as a dashboard deliverable
 */
export async function generateSeasonalContent(
  jobData: SeasonalContentJobData
): Promise<SeasonalContentResult> {
  const {
    propertyId,
    userId,
    propertyTitle,
    propertyDescription,
    location,
    propertyType,
    amenities,
    ownerTone,
    currentDate,
  } = jobData

  try {
    // 1. Detect seasonal context
    const seasonalContext = detectSeasonalContext({
      location,
      propertyType,
      amenities,
      currentDate: currentDate ? new Date(currentDate) : undefined,
    })

    console.log(`[SeasonalContent] Property ${propertyId}: ${seasonalContext.season} / ${seasonalContext.holiday || 'no holiday'} → ${seasonalContext.targetMonth}`)

    // 2. Build prompt
    const prompt = buildSeasonalContentPrompt({
      propertyTitle,
      propertyDescription,
      location,
      propertyType,
      amenities,
      season: seasonalContext.season,
      holiday: seasonalContext.holiday || '',
      seasonalTheme: seasonalContext.seasonalTheme,
      targetMonth: seasonalContext.targetMonth,
      ownerTone: ownerTone || 'warm and welcoming',
    })

    // 3. Generate content via Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const rawContent = message.content[0]
    if (rawContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // 4. Parse JSON response
    let seasonalContent: Record<string, unknown>
    try {
      // Strip any accidental markdown fences
      const cleaned = rawContent.text
        .replace(/^```json\n?/m, '')
        .replace(/^```\n?/m, '')
        .replace(/```$/m, '')
        .trim()
      seasonalContent = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('[SeasonalContent] Failed to parse Claude response:', rawContent.text.slice(0, 500))
      throw new Error('Failed to parse seasonal content from AI response')
    }

    // 5. Save to seasonal_content_deliverables table
    const deliverable = {
      property_id: propertyId,
      user_id: userId,
      season: seasonalContext.season,
      holiday: seasonalContext.holiday,
      seasonal_theme: seasonalContext.seasonalTheme,
      target_month: seasonalContext.targetMonth,
      target_date: seasonalContext.targetDate.toISOString(),
      property_context: seasonalContext.propertyContext,
      content: seasonalContent,
      status: 'pending_review',
      generated_at: new Date().toISOString(),
    }

    const { data: saved, error: saveError } = await supabase
      .from('seasonal_content_deliverables')
      .insert(deliverable)
      .select('id')
      .single()

    if (saveError) {
      throw new Error(`Failed to save deliverable: ${saveError.message}`)
    }

    // 6. Update the property's last_seasonal_update timestamp
    await supabase
      .from('properties')
      .update({ last_seasonal_update: new Date().toISOString() })
      .eq('id', propertyId)

    console.log(`[SeasonalContent] ✓ Deliverable saved: ${saved.id} for property ${propertyId}`)

    return {
      success: true,
      deliverableId: saved.id,
      season: seasonalContext.season,
      holiday: seasonalContext.holiday,
      targetMonth: seasonalContext.targetMonth,
    }
  } catch (error) {
    console.error(`[SeasonalContent] Error for property ${propertyId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
