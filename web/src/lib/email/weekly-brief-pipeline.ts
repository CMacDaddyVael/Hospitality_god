import { createClient } from '@supabase/supabase-js'
import { sendWeeklyBrief } from './resend-weekly-brief'
import type { WeeklyBriefData, DeliverableGroup } from './weekly-brief-types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PipelineResult {
  processed: number
  sent: number
  failed: number
  skipped: number
  details: Array<{
    ownerId: string
    email: string
    status: 'sent' | 'failed' | 'skipped'
    reason?: string
  }>
}

interface PipelineOptions {
  ownerIdFilter?: string
}

/**
 * Main entry point for the weekly brief pipeline.
 * Fetches all active Pro subscribers, assembles their brief, and sends it.
 */
export async function runWeeklyBriefPipeline(
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const result: PipelineResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  }

  // 1. Fetch all active Pro subscribers
  const owners = await fetchActiveProOwners(options.ownerIdFilter)
  console.log(`[weekly-brief] Found ${owners.length} active Pro owners to process`)

  // 2. Process each owner sequentially (avoid rate limits on Resend + Supabase)
  for (const owner of owners) {
    result.processed++

    try {
      // 3. Determine if it's 8am in the owner's local timezone
      //    If timezone is set and it's not their Monday morning, skip this run
      //    (The cron runs hourly; we pick the right hour per owner)
      if (!isOwnerSendWindow(owner.timezone)) {
        result.skipped++
        result.details.push({
          ownerId: owner.id,
          email: owner.email,
          status: 'skipped',
          reason: `Not send window for timezone ${owner.timezone ?? 'UTC'}`,
        })
        continue
      }

      // 4. Assemble brief data
      const briefData = await assembleBriefForOwner(owner)

      // 5. Skip if nothing to report this week
      if (!briefData.hasContent) {
        result.skipped++
        result.details.push({
          ownerId: owner.id,
          email: owner.email,
          status: 'skipped',
          reason: 'No deliverables this week',
        })
        await logEmailAttempt({
          ownerId: owner.id,
          email: owner.email,
          status: 'skipped',
          reason: 'No deliverables this week',
        })
        continue
      }

      // 6. Send the email
      await sendWeeklyBrief(owner.email, owner.first_name ?? 'there', briefData)

      result.sent++
      result.details.push({
        ownerId: owner.id,
        email: owner.email,
        status: 'sent',
      })

      await logEmailAttempt({
        ownerId: owner.id,
        email: owner.email,
        status: 'sent',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[weekly-brief] Failed for owner ${owner.id}:`, errorMessage)

      result.failed++
      result.details.push({
        ownerId: owner.id,
        email: owner.email,
        status: 'failed',
        reason: errorMessage,
      })

      await logEmailAttempt({
        ownerId: owner.id,
        email: owner.email,
        status: 'failed',
        reason: errorMessage,
      })
    }
  }

  console.log(
    `[weekly-brief] Pipeline complete — processed: ${result.processed}, sent: ${result.sent}, failed: ${result.failed}, skipped: ${result.skipped}`
  )

  return result
}

// ---------------------------------------------------------------------------
// Owner fetching
// ---------------------------------------------------------------------------

interface OwnerRow {
  id: string
  email: string
  first_name: string | null
  timezone: string | null
}

async function fetchActiveProOwners(ownerIdFilter?: string): Promise<OwnerRow[]> {
  let query = supabase
    .from('users')
    .select('id, email, first_name, timezone')
    .eq('subscription_status', 'active')
    .eq('subscription_tier', 'pro')

  if (ownerIdFilter) {
    query = query.eq('id', ownerIdFilter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch active Pro owners: ${error.message}`)
  }

  return (data ?? []) as OwnerRow[]
}

// ---------------------------------------------------------------------------
// Send-window check (Monday 8am ± 30 min in owner's timezone)
// ---------------------------------------------------------------------------

function isOwnerSendWindow(timezone: string | null): boolean {
  // If no timezone is set, always send (assume UTC Monday morning runs are fine)
  if (!timezone) return true

  try {
    const now = new Date()
    // Use Intl to get the owner's local time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const weekday = parts.find((p) => p.type === 'weekday')?.value
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)

    // Send on Monday between 7:30am and 8:30am local time
    const isMonday = weekday === 'Mon'
    const isCorrectHour = hour === 8 // 0800 local

    return isMonday && isCorrectHour
  } catch {
    // Invalid timezone string — fall through and send anyway
    return true
  }
}

// ---------------------------------------------------------------------------
// Brief assembly
// ---------------------------------------------------------------------------

async function assembleBriefForOwner(owner: OwnerRow): Promise<WeeklyBriefData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all properties for this owner
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, airbnb_url')
    .eq('owner_id', owner.id)

  const propertyIds = (properties ?? []).map((p: { id: string }) => p.id)

  if (propertyIds.length === 0) {
    return { hasContent: false, deliverableGroups: [], ownerName: owner.first_name ?? 'there' }
  }

  // Fetch all deliverables from the past 7 days
  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('id, type, title, summary, status, created_at, property_id, metadata')
    .in('property_id', propertyIds)
    .in('status', ['pending', 'approved'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })

  // Fetch listing score delta if an audit ran this week
  const scoreDelta = await fetchScoreDelta(propertyIds, sevenDaysAgo)

  // Group deliverables by type
  const deliverableGroups = groupDeliverablesByType(deliverables ?? [], properties ?? [])

  const hasContent = deliverableGroups.some((g) => g.items.length > 0) || scoreDelta !== null

  return {
    hasContent,
    ownerName: owner.first_name ?? 'there',
    deliverableGroups,
    scoreDelta,
    weekOf: formatWeekOf(),
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vael.host',
  }
}

function groupDeliverablesByType(
  deliverables: any[],
  properties: any[]
): DeliverableGroup[] {
  const propertyMap = new Map(properties.map((p: any) => [p.id, p]))

  const typeConfig: Array<{
    type: string
    label: string
    icon: string
    description: string
  }> = [
    {
      type: 'listing_copy',
      label: 'Listing Optimization',
      icon: '🏡',
      description: 'Rewritten titles, descriptions, and tags ready to copy-paste into Airbnb.',
    },
    {
      type: 'review_response',
      label: 'Review Responses',
      icon: '⭐',
      description: 'Drafted responses to your recent guest reviews — in your voice.',
    },
    {
      type: 'social_post',
      label: 'Social Media Posts',
      icon: '📱',
      description: 'Instagram and TikTok captions with lifestyle imagery, ready to post.',
    },
    {
      type: 'competitive_intel',
      label: 'Competitive Intelligence',
      icon: '🔍',
      description: 'What your competitors changed this week and how you can respond.',
    },
    {
      type: 'guest_message',
      label: 'Guest Message Templates',
      icon: '💬',
      description: 'Ready-to-use message templates for common guest scenarios.',
    },
    {
      type: 'health_score',
      label: 'Listing Health Report',
      icon: '📊',
      description: 'Analysis of your listing performance and optimization opportunities.',
    },
  ]

  const groups: DeliverableGroup[] = []

  for (const config of typeConfig) {
    const matchingDeliverables = deliverables.filter((d) => d.type === config.type)
    if (matchingDeliverables.length === 0) continue

    const items = matchingDeliverables.map((d) => {
      const property = propertyMap.get(d.property_id)
      return {
        id: d.id,
        title: d.title ?? inferTitle(d.type, property?.name),
        summary: d.summary ?? inferSummary(d.type, d.metadata),
        status: d.status,
        propertyName: property?.name ?? 'Your Property',
        createdAt: d.created_at,
        deepLink: buildDeepLink(d.id, d.type),
      }
    })

    groups.push({
      type: config.type,
      label: config.label,
      icon: config.icon,
      description: config.description,
      items,
      count: items.length,
    })
  }

  return groups
}

function inferTitle(type: string, propertyName: string | undefined): string {
  const name = propertyName ?? 'Your Property'
  const titles: Record<string, string> = {
    listing_copy: `Updated Listing Copy — ${name}`,
    review_response: `Review Response Draft — ${name}`,
    social_post: `Social Post — ${name}`,
    competitive_intel: `Competitive Analysis — ${name}`,
    guest_message: `Guest Message Template — ${name}`,
    health_score: `Listing Health Report — ${name}`,
  }
  return titles[type] ?? `New Deliverable — ${name}`
}

function inferSummary(type: string, metadata: any): string {
  if (metadata?.summary) return metadata.summary

  const summaries: Record<string, string> = {
    listing_copy: 'Optimized title and description to improve search ranking and conversion.',
    review_response: 'A personalized response ready to post — matches your communication style.',
    social_post: 'Caption and hashtag set crafted for maximum reach on Instagram.',
    competitive_intel: 'Key changes spotted among your top competitors this week.',
    guest_message: 'A reusable template for a common guest scenario.',
    health_score: 'Updated health score with specific improvement recommendations.',
  }
  return summaries[type] ?? 'New deliverable ready for your review.'
}

function buildDeepLink(deliverableId: string, type: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vael.host'
  return `${base}/dashboard/deliverables?id=${deliverableId}&type=${type}`
}

function formatWeekOf(): string {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  return now.toLocaleDateString('en-US', options)
}

// ---------------------------------------------------------------------------
// Score delta
// ---------------------------------------------------------------------------

interface ScoreDelta {
  previous: number
  current: number
  delta: number
  propertyName: string
}

async function fetchScoreDelta(
  propertyIds: string[],
  since: string
): Promise<ScoreDelta | null> {
  if (propertyIds.length === 0) return null

  // Find the most recent audit that ran within the past 7 days
  const { data: recentAudits } = await supabase
    .from('listing_audits')
    .select('property_id, score, previous_score, created_at, properties(name)')
    .in('property_id', propertyIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!recentAudits || recentAudits.length === 0) return null

  const audit = recentAudits[0]
  if (audit.previous_score === null || audit.previous_score === undefined) return null

  const delta = audit.score - audit.previous_score

  // Only show if there was meaningful change
  if (Math.abs(delta) < 1) return null

  return {
    previous: Math.round(audit.previous_score),
    current: Math.round(audit.score),
    delta: Math.round(delta),
    propertyName: (audit.properties as any)?.name ?? 'Your Property',
  }
}

// ---------------------------------------------------------------------------
// Email logging
// ---------------------------------------------------------------------------

async function logEmailAttempt(params: {
  ownerId: string
  email: string
  status: 'sent' | 'failed' | 'skipped'
  reason?: string
}): Promise<void> {
  try {
    const { error } = await supabase.from('email_logs').insert({
      owner_id: params.ownerId,
      email_type: 'weekly_brief',
      recipient_email: params.email,
      status: params.status,
      error_reason: params.reason ?? null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[weekly-brief] Failed to log email attempt:', error.message)
    }
  } catch (err) {
    // Logging failure should never crash the pipeline
    console.error('[weekly-brief] Exception while logging email attempt:', err)
  }
}
