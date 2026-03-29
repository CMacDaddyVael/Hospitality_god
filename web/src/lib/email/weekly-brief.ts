import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { renderWeeklyBriefEmail } from './weekly-brief-template'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hospitalitygod.com'
const FROM_EMAIL = process.env.FROM_EMAIL || 'team@hospitalitygod.com'
const FROM_NAME = 'Hospitality God'

export interface DeliverableSummary {
  type: string
  label: string
  count: number
  dashboardPath: string
}

export interface WeeklyBriefData {
  userId: string
  userEmail: string
  propertyName: string
  listingScore: number
  previousListingScore: number | null
  deliverables: DeliverableSummary[]
  weekStart: Date
  weekEnd: Date
  unsubscribeToken: string
}

export interface SendResult {
  sent: number
  skipped: number
  errors: number
  details: Array<{ userId: string; status: string; reason?: string }>
}

// Deliverable type → human-readable label + dashboard path
const DELIVERABLE_TYPE_META: Record<string, { label: string; dashboardPath: string }> = {
  social_caption: { label: 'Instagram caption', dashboardPath: '/dashboard/deliverables?type=social_caption' },
  social_post: { label: 'social post', dashboardPath: '/dashboard/deliverables?type=social_post' },
  review_response: { label: 'review response', dashboardPath: '/dashboard/deliverables?type=review_response' },
  listing_rewrite: { label: 'listing rewrite', dashboardPath: '/dashboard/deliverables?type=listing_rewrite' },
  guest_message: { label: 'guest message template', dashboardPath: '/dashboard/deliverables?type=guest_message' },
  lifestyle_photo: { label: 'lifestyle photo', dashboardPath: '/dashboard/photos' },
  seo_content: { label: 'SEO content piece', dashboardPath: '/dashboard/deliverables?type=seo_content' },
  seasonal_update: { label: 'seasonal update', dashboardPath: '/dashboard/deliverables?type=seasonal_update' },
  competitive_analysis: { label: 'competitive insight', dashboardPath: '/dashboard/deliverables?type=competitive_analysis' },
}

/**
 * Main entry point — fetches all eligible Pro users and sends their weekly briefs.
 */
export async function sendWeeklyBriefs(): Promise<SendResult> {
  const result: SendResult = { sent: 0, skipped: 0, errors: 0, details: [] }

  const weekEnd = new Date()
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Fetch all active Pro users who haven't unsubscribed from email briefs
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, unsubscribe_token, timezone, properties(id, name, listing_score, previous_listing_score)')
    .eq('plan', 'pro')
    .eq('email_brief', true)
    .eq('status', 'active')

  if (usersError) {
    console.error('Failed to fetch Pro users:', usersError)
    throw new Error(`Failed to fetch Pro users: ${usersError.message}`)
  }

  if (!users || users.length === 0) {
    console.log('No eligible Pro users found')
    return result
  }

  console.log(`Processing weekly briefs for ${users.length} Pro users`)

  for (const user of users) {
    try {
      const briefResult = await processUserBrief(user, weekStart, weekEnd)
      if (briefResult.sent) {
        result.sent++
        result.details.push({ userId: user.id, status: 'sent' })
      } else {
        result.skipped++
        result.details.push({ userId: user.id, status: 'skipped', reason: briefResult.reason })
      }
    } catch (err) {
      console.error(`Error processing brief for user ${user.id}:`, err)
      result.errors++
      result.details.push({ userId: user.id, status: 'error', reason: String(err) })
    }
  }

  console.log(`Weekly brief run complete — sent: ${result.sent}, skipped: ${result.skipped}, errors: ${result.errors}`)
  return result
}

interface UserRow {
  id: string
  email: string
  unsubscribe_token: string
  timezone: string | null
  properties: Array<{
    id: string
    name: string
    listing_score: number
    previous_listing_score: number | null
  }> | null
}

async function processUserBrief(
  user: UserRow,
  weekStart: Date,
  weekEnd: Date
): Promise<{ sent: boolean; reason?: string }> {
  // Get the user's primary property
  const properties = Array.isArray(user.properties) ? user.properties : []
  const property = properties[0]

  if (!property) {
    return { sent: false, reason: 'no_property' }
  }

  // Fetch deliverables created in the past 7 days for this user's properties
  const propertyIds = properties.map((p) => p.id)

  const { data: deliverables, error: delError } = await supabase
    .from('deliverables')
    .select('type, status, created_at')
    .in('property_id', propertyIds)
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString())

  if (delError) {
    throw new Error(`Failed to fetch deliverables: ${delError.message}`)
  }

  // Suppress email if zero deliverables
  if (!deliverables || deliverables.length === 0) {
    return { sent: false, reason: 'no_deliverables' }
  }

  // Group deliverables by type with counts
  const typeMap: Record<string, number> = {}
  for (const d of deliverables) {
    typeMap[d.type] = (typeMap[d.type] || 0) + 1
  }

  const deliverableSummaries: DeliverableSummary[] = Object.entries(typeMap).map(
    ([type, count]) => {
      const meta = DELIVERABLE_TYPE_META[type] ?? {
        label: type.replace(/_/g, ' '),
        dashboardPath: '/dashboard/deliverables',
      }
      return {
        type,
        label: meta.label,
        count,
        dashboardPath: meta.dashboardPath,
      }
    }
  )

  // Ensure the user has an unsubscribe token — generate one if missing
  let unsubscribeToken = user.unsubscribe_token
  if (!unsubscribeToken) {
    unsubscribeToken = generateToken()
    await supabase
      .from('users')
      .update({ unsubscribe_token: unsubscribeToken })
      .eq('id', user.id)
  }

  const briefData: WeeklyBriefData = {
    userId: user.id,
    userEmail: user.email,
    propertyName: property.name || 'Your Property',
    listingScore: property.listing_score || 0,
    previousListingScore: property.previous_listing_score ?? null,
    deliverables: deliverableSummaries,
    weekStart,
    weekEnd,
    unsubscribeToken,
  }

  // Render the email HTML
  const { html, text } = renderWeeklyBriefEmail(briefData)

  // Send via Resend
  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: user.email,
    subject: buildSubjectLine(briefData),
    html,
    text,
    tags: [
      { name: 'type', value: 'weekly_brief' },
      { name: 'user_id', value: user.id },
    ],
  })

  if (sendError) {
    throw new Error(`Resend error: ${sendError.message}`)
  }

  // Log delivery to email_briefs table
  await supabase.from('email_briefs').insert({
    user_id: user.id,
    property_id: property.id,
    resend_email_id: sendData?.id ?? null,
    sent_at: new Date().toISOString(),
    deliverable_count: deliverables.length,
    deliverable_types: typeMap,
    listing_score: property.listing_score,
    previous_listing_score: property.previous_listing_score,
    week_start: weekStart.toISOString(),
    week_end: weekEnd.toISOString(),
    open_tracked: false,
  })

  console.log(`Brief sent to ${user.email} (${deliverables.length} deliverables)`)
  return { sent: true }
}

function buildSubjectLine(data: WeeklyBriefData): string {
  const total = data.deliverables.reduce((sum, d) => sum + d.count, 0)
  const scoreChange =
    data.previousListingScore !== null
      ? data.listingScore - data.previousListingScore
      : null

  if (scoreChange !== null && scoreChange > 0) {
    return `🏆 Your marketing team prepared ${total} deliverable${total !== 1 ? 's' : ''} — score up ${scoreChange} pts`
  }

  const typeNames = data.deliverables.slice(0, 2).map((d) => pluralize(d.label, d.count))
  const preview = typeNames.join(', ')

  return `✅ ${total} deliverable${total !== 1 ? 's' : ''} ready: ${preview}${data.deliverables.length > 2 ? ' & more' : ''}`
}

function pluralize(label: string, count: number): string {
  if (count === 1) return `1 ${label}`
  // Simple pluralization
  if (label.endsWith('s')) return `${count} ${label}`
  if (label.endsWith('y')) return `${count} ${label.slice(0, -1)}ies`
  return `${count} ${label}s`
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
