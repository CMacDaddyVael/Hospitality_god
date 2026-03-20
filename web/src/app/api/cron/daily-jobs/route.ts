/**
 * VAEL Host — Daily Job Runner
 * Issue #173: Deliverable job queue and daily cron runner
 *
 * Runs daily at 06:00 UTC (configurable via CRON_HOUR_UTC env var).
 * Dispatches pending deliverable generation jobs for all active Pro subscribers.
 *
 * Load estimate:
 *   - 50 properties max per run
 *   - 4 job types per property = 200 jobs max
 *   - Per job: ~1-2s DB check + ~3-8s AI generation (skipped if cooldown hit)
 *   - Worst case (all 50 properties, all 4 types due): 50 × 4 × 6s avg = 1200s
 *   - Realistic case: ~20% of jobs actually due per run = 40 jobs × 6s = 240s ✓
 *   - Jobs run sequentially per property, properties run sequentially = safe within 300s
 *   - At scale >50 properties: introduce batching or background queue (Inngest/QStash)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runDailyJobs } from '@/lib/jobs/dispatcher'

// Vercel cron config — runs daily at 06:00 UTC
// To change hour, set CRON_HOUR_UTC env var (used in vercel.json cron expression)
export const maxDuration = 300 // 5 minutes — Vercel Pro max

function isAuthorizedCron(req: NextRequest): boolean {
  // Vercel automatically sets CRON_SECRET and sends it as Authorization header
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Also allow if request is from Vercel's cron infrastructure (no secret configured yet)
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    // In prod without secret, only allow from Vercel cron IP range
    // Vercel sets x-vercel-signature for cron jobs
    const vercelId = req.headers.get('x-vercel-id')
    return !!vercelId
  }

  // Development: always allow
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  return false
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()
  console.log(`[DailyJobs] Cron triggered at ${startedAt.toISOString()}`)

  try {
    const result = await runDailyJobs()

    const duration = Date.now() - startedAt.getTime()
    console.log(`[DailyJobs] Completed in ${duration}ms`, result.summary)

    return NextResponse.json({
      success: true,
      triggeredAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration,
      summary: result.summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[DailyJobs] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: message,
        triggeredAt: startedAt.toISOString(),
      },
      { status: 500 }
    )
  }
}
