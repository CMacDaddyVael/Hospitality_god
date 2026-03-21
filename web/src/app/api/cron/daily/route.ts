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

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch all active subscribers
    const { data: subscribers, error: fetchError } = await supabase
      .from('subscribers')
      .select('id, email, listing_url, preferences')
      .eq('subscription_status', 'active')

    if (fetchError) {
      console.error('[cron/daily] Failed to fetch subscribers:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscribers found',
        enqueued: 0,
      })
    }

    const DAILY_JOB_TYPES = ['review_scan', 'competitor_check'] as const
    const jobsToInsert: Array<{
      subscriber_id: string
      job_type: string
      status: string
      payload: Record<string, unknown>
    }> = []

    for (const subscriber of subscribers) {
      for (const jobType of DAILY_JOB_TYPES) {
        jobsToInsert.push({
          subscriber_id: subscriber.id,
          job_type: jobType,
          status: 'queued',
          payload: {
            email: subscriber.email,
            listing_url: subscriber.listing_url,
            preferences: subscriber.preferences ?? {},
            scheduled_at: new Date().toISOString(),
            cadence: 'daily',
          },
        })
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('jobs')
      .insert(jobsToInsert)
      .select('id')

    if (insertError) {
      console.error('[cron/daily] Failed to enqueue jobs:', insertError)
      return NextResponse.json({ error: 'Failed to enqueue jobs' }, { status: 500 })
    }

    console.log(
      `[cron/daily] Enqueued ${jobsToInsert.length} jobs for ${subscribers.length} subscribers`
    )

    return NextResponse.json({
      success: true,
      subscribers: subscribers.length,
      jobs_enqueued: jobsToInsert.length,
      job_types: DAILY_JOB_TYPES,
    })
  } catch (err) {
    console.error('[cron/daily] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Allow Vercel cron to call via GET as well
export async function GET(req: NextRequest) {
  return POST(req)
}
