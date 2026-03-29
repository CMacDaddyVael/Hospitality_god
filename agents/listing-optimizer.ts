import { createClient } from '@supabase/supabase-js'
import { promptEngine } from '../lib/ai/prompt-engine'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RawListing = {
  title: string
  description: string
  amenities: string[]
  photos?: string[]
  location?: string
  propertyType?: string
  pricePerNight?: number
}

export type OptimizedListing = {
  title: string
  description: string
  tags: string[]
  reasoning: string
}

export type ListingOptimizerResult = OptimizedListing & {
  property_id: string
  task_id: string
  token_cost: number
  run_at: string
}

export async function optimizeListing(property_id: string): Promise<ListingOptimizerResult> {
  const taskStart = Date.now()

  // 1. Fetch property from DB
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', property_id)
    .single()

  if (propError || !property) {
    throw new Error(`Property not found: ${property_id} — ${propError?.message}`)
  }

  const rawListing: RawListing = {
    title: property.title || '',
    description: property.description || '',
    amenities: property.amenities || [],
    photos: property.photos || [],
    location: property.location || property.city || '',
    propertyType: property.property_type || '',
    pricePerNight: property.price_per_night || 0,
  }

  // 2. Load SEO knowledge base for context injection
  let seoContext = ''
  try {
    const kbPath = path.resolve(process.cwd(), 'knowledge-base/seo-geo.md')
    const raw = fs.readFileSync(kbPath, 'utf-8')
    // Extract the most relevant sections (keep under ~3000 chars to stay within prompt budget)
    seoContext = extractRelevantSeoContext(raw)
  } catch (err) {
    console.warn('Could not load SEO knowledge base, proceeding without it:', err)
  }

  // 3. Log task as "running"
  const { data: taskRow, error: taskError } = await supabase
    .from('agent_tasks')
    .insert({
      property_id,
      task_type: 'listing_optimization',
      status: 'running',
      input: rawListing,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (taskError) {
    console.error('Failed to create agent_task row:', taskError.message)
  }

  const task_id = taskRow?.id ?? 'unknown'

  // 4. Call the prompt engine
  let result: OptimizedListing
  let tokenCost = 0

  try {
    const engineResult = await promptEngine('listing_rewrite', {
      rawListing,
      seoContext,
    })

    result = engineResult.output as OptimizedListing
    tokenCost = engineResult.tokenCost ?? 0
  } catch (err: any) {
    // Update task as failed
    await supabase
      .from('agent_tasks')
      .update({
        status: 'failed',
        error: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task_id)

    throw new Error(`Prompt engine failed: ${err.message}`)
  }

  // 5. Validate output shape — enforce constraints
  result.title = enforceTitle(result.title, rawListing)
  result.tags = enforceTags(result.tags)

  const run_at = new Date().toISOString()

  // 6. Save optimized listing to properties table
  const { error: updateError } = await supabase
    .from('properties')
    .update({
      optimized_listing: result,
      optimization_run_at: run_at,
    })
    .eq('id', property_id)

  if (updateError) {
    console.error('Failed to save optimized_listing to properties:', updateError.message)
  }

  // 7. Update agent_tasks row with output + cost
  await supabase
    .from('agent_tasks')
    .update({
      status: 'complete',
      output: result,
      token_cost: tokenCost,
      completed_at: run_at,
      duration_ms: Date.now() - taskStart,
    })
    .eq('id', task_id)

  return {
    ...result,
    property_id,
    task_id,
    token_cost: tokenCost,
    run_at,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pull the most actionable sections from the SEO knowledge base so we don't
 * blow out the context window.  Keeps heading lines + the first 2 bullets
 * under each relevant section.
 */
function extractRelevantSeoContext(raw: string): string {
  const targetSections = [
    'listing optimization',
    'title',
    'description',
    'tags',
    'keywords',
    'airbnb',
    'seo',
    'search',
  ]

  const lines = raw.split('\n')
  const kept: string[] = []
  let inRelevantSection = false
  let bulletCount = 0
  const MAX_CHARS = 3000

  for (const line of lines) {
    if (kept.join('\n').length >= MAX_CHARS) break

    const isHeading = line.startsWith('#')
    if (isHeading) {
      const lower = line.toLowerCase()
      inRelevantSection = targetSections.some((kw) => lower.includes(kw))
      bulletCount = 0
      if (inRelevantSection) kept.push(line)
      continue
    }

    if (inRelevantSection) {
      const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*')
      if (isBullet && bulletCount < 6) {
        kept.push(line)
        bulletCount++
      } else if (!isBullet && line.trim().length > 0) {
        // short prose lines — keep them
        kept.push(line)
      }
    }
  }

  return kept.join('\n').trim()
}

/**
 * Enforce title is 45-50 characters.  If AI went over, truncate gracefully.
 * If under 40, warn but keep it (better than corrupting the copy).
 */
function enforceTitle(title: string, raw: RawListing): string {
  const t = title.trim()

  if (t.length >= 40 && t.length <= 52) return t

  if (t.length > 52) {
    // Truncate at last word boundary before 50 chars
    const truncated = t.slice(0, 50).replace(/\s+\S*$/, '')
    console.warn(`Title truncated from ${t.length} to ${truncated.length} chars`)
    return truncated
  }

  // Too short — return as-is and log
  console.warn(`Title is only ${t.length} chars — returning as-is: "${t}"`)
  return t
}

/**
 * Enforce minimum 10 tags; deduplicate and lowercase.
 */
function enforceTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return []
  const cleaned = [...new Set(tags.map((t) => t.toLowerCase().trim()))].filter(Boolean)
  if (cleaned.length < 10) {
    console.warn(`Only ${cleaned.length} tags returned — expected ≥ 10`)
  }
  return cleaned
}
