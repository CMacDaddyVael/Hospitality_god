/**
 * Weekly brief email logic
 *
 * Fetches active Pro subscribers, builds per-subscriber payloads,
 * renders HTML + plain-text, sends via Resend, logs open/click events.
 */

import { createClient } from '@supabase/supabase-js'
import { resend, FROM_ADDRESS, REPLY_TO, APP_URL } from './resend'
import { renderWeeklyBriefHtml } from './templates/weekly-brief-html'
import { renderWeeklyBriefText } from './templates/weekly-brief-text'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliverablePreview {
  id: string
  type: string        // 'social_post' | 'listing_rewrite' | 'review_response' | 'seasonal_update' | …
  title: string
  summary: string     // 1–2 sentence teaser
  created_at: string
}

export interface SubscriberBriefPayload {
  userId: string
  email: string
  propertyName: string
  listingUrl: string | null
  currentScore: number | null
  previousScore: number | null
  scoreDelta: number | null
  deliverables: DeliverablePreview[]
  unsubscribeToken: string
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Fetch active Pro subscribers with pending deliverables
// ---------------------------------------------------------------------------

export async function fetchBriefPayloads(): Promise<SubscriberBriefPayload[]> {
  const supabase = getSupabase()

  // 1. Pull all Pro subscribers whose email_unsubscribed is false (or null)
  const { data: subscribers, error: subErr } = await supabase
    .from('subscribers')
    .select('id, email, property_name, listing_url, unsubscribe_token')
    .eq('plan', 'pro')
    .eq('status', 'active')
    .or('email_unsubscribed.is.null,email_unsubscribed.eq.false')

  if (subErr) throw new Error(`Failed to fetch subscribers: ${subErr.message}`)
  if (!subscribers || subscribers.length === 0) return []

  const userIds = subscribers.map((s) => s.id)

  // 2. Fetch pending deliverables created in the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: deliverables, error: delErr } = await supabase
    .from('deliverables')
    .select('id, user_id, type, title, summary, created_at')
    .in('user_id', userIds)
    .eq('status', 'pending')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })

  if (delErr) throw new Error(`Failed to fetch deliverables: ${delErr.message}`)

  // 3. Fetch latest scores (current + previous) for each user
  const { data: scores, error: scoreErr } = await supabase
    .from('listing_scores')
    .select('user_id, score, recorded_at')
    .in('user_id', userIds)
    .order('recorded_at', { ascending: false })

  if (scoreErr) throw new Error(`Failed to fetch scores: ${scoreErr.message}`)

  // Group deliverables by user
  const deliverablesByUser: Record<string, DeliverablePreview[]> = {}
  for (const d of deliverables ?? []) {
    if (!deliverablesByUser[d.user_id]) deliverablesByUser[d.user_id] = []
    deliverablesByUser[d.user_id].push({
      id: d.id,
      type: d.type,
      title: d.title,
      summary: d.summary,
      created_at: d.created_at,
    })
  }

  // Group scores by user (already ordered desc by recorded_at)
  const scoresByUser: Record<string, number[]> = {}
  for (const s of scores ?? []) {
    if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = []
    scoresByUser[s.user_id].push(s.score)
  }

  // 4. Build payloads — only include subscribers who have ≥1 deliverable
  const payloads: SubscriberBriefPayload[] = []

  for (const sub of subscribers) {
    const userDeliverables = deliverablesByUser[sub.id] ?? []
    if (userDeliverables.length === 0) continue // AC: skip if no new deliverables

    const userScores = scoresByUser[sub.id] ?? []
    const currentScore = userScores[0] ?? null
    const previousScore = userScores[1] ?? null
    const scoreDelta =
      currentScore !== null && previousScore !== null
        ? currentScore - previousScore
        : null

    payloads.push({
      userId: sub.id,
      email: sub.email,
      propertyName: sub.property_name ?? 'Your Property',
      listingUrl: sub.listing_url ?? null,
      currentScore,
      previousScore,
      scoreDelta,
      deliverables: userDeliverables.slice(0, 3), // cap at 3 previews
      unsubscribeToken: sub.unsubscribe_token,
    })
  }

  return payloads
}

// ---------------------------------------------------------------------------
// Send a single brief and log the send event
// ---------------------------------------------------------------------------

export async function sendWeeklyBrief(payload: SubscriberBriefPayload): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  const supabase = getSupabase()

  const dashboardUrl = `${APP_URL}/dashboard?ref=weekly_brief`
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${payload.unsubscribeToken}`

  const subject = buildSubjectLine(payload)
  const html = renderWeeklyBriefHtml({ ...payload, dashboardUrl, unsubscribeUrl, subject })
  const text = renderWeeklyBriefText({ ...payload, dashboardUrl, unsubscribeUrl, subject })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [payload.email],
      reply_to: REPLY_TO,
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (error) {
      console.error(`[WeeklyBrief] Resend error for ${payload.email}:`, error)
      return { success: false, error: error.message }
    }

    const messageId = (data as any)?.id ?? null

    // Log send event
    await supabase.from('email_events').insert({
      user_id: payload.userId,
      email: payload.email,
      event_type: 'sent',
      email_type: 'weekly_brief',
      message_id: messageId,
      metadata: {
        deliverable_count: payload.deliverables.length,
        score_delta: payload.scoreDelta,
      },
    })

    return { success: true, messageId }
  } catch (err: any) {
    console.error(`[WeeklyBrief] Unexpected error for ${payload.email}:`, err)
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// Run the full weekly brief job
// ---------------------------------------------------------------------------

export async function runWeeklyBriefJob(): Promise<{
  total: number
  sent: number
  skipped: number
  failed: number
  errors: string[]
}> {
  console.log('[WeeklyBrief] Starting weekly brief job…')

  const payloads = await fetchBriefPayloads()
  console.log(`[WeeklyBrief] ${payloads.length} subscriber(s) with new deliverables`)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const payload of payloads) {
    const result = await sendWeeklyBrief(payload)
    if (result.success) {
      sent++
      console.log(`[WeeklyBrief] ✓ Sent to ${payload.email} (${result.messageId})`)
    } else {
      failed++
      errors.push(`${payload.email}: ${result.error}`)
      console.error(`[WeeklyBrief] ✗ Failed ${payload.email}: ${result.error}`)
    }

    // Gentle rate-limit: 10 req/s is Resend's default burst limit
    await sleep(120)
  }

  console.log(`[WeeklyBrief] Done. sent=${sent} failed=${failed} skipped=${payloads.length === 0 ? 'all (no deliverables)' : 0}`)

  return {
    total: payloads.length,
    sent,
    skipped: 0, // skipping is done pre-payload in fetchBriefPayloads
    failed,
    errors,
  }
}

function buildSubjectLine(payload: SubscriberBriefPayload): string {
  const count = payload.deliverables.length
  const plural = count === 1 ? 'deliverable' : 'deliverables'
  if (payload.scoreDelta !== null && payload.scoreDelta > 0) {
    return `📈 Your marketing team is ready — ${count} ${plural} + score up ${payload.scoreDelta} pts`
  }
  if (payload.scoreDelta !== null && payload.scoreDelta < 0) {
    return `📋 ${count} new ${plural} ready for ${payload.propertyName}`
  }
  return `📋 Your marketing team prepared ${count} ${plural} this week`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
