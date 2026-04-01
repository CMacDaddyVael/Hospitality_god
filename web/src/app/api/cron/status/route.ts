import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifySecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Count jobs by status for last 24h
    const { data: statusCounts, error: countError } = await supabase
      .from('jobs')
      .select('status')
      .gte('created_at', since)

    if (countError) {
      console.error('[cron/status] Failed to query jobs:', countError)
      return NextResponse.json({ error: 'Failed to query jobs' }, { status: 500 })
    }

    const counts: Record<string, number> = {
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
    }

    for (const row of statusCounts ?? []) {
      const s = row.status as string
      if (s in counts) {
        counts[s]++
      } else {
        counts[s] = (counts[s] ?? 0) + 1
      }
    }

    // Fetch recent failures with error messages for visibility
    const { data: recentFailures, error: failError } = await supabase
      .from('jobs')
      .select('id, subscriber_id, job_type, error_message, created_at')
      .eq('status', 'failed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    if (failError) {
      console.error('[cron/status] Failed to query failures:', failError)
      // Non-fatal — still return counts
    }

    // Fetch counts by job_type for last 24h
    const { data: typeCounts, error: typeError } = await supabase
      .from('jobs')
      .select('job_type, status')
      .gte('created_at', since)

    if (typeError) {
      console.error('[cron/status] Failed to query type breakdown:', typeError)
    }

    const byJobType: Record<string, Record<string, number>> = {}
    for (const row of typeCounts ?? []) {
      const t = row.job_type as string
      const s = row.status as string
      if (!byJobType[t]) byJobType[t] = {}
      byJobType[t][s] = (byJobType[t][s] ?? 0) + 1
    }

    return NextResponse.json({
      success: true,
      window: '24h',
      since,
      totals: counts,
      by_job_type: byJobType,
      recent_failures: recentFailures ?? [],
    })
  } catch (err) {
    console.error('[cron/status] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
