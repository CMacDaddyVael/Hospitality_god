/**
 * GET /api/cron/weekly
 *
 * Called by Vercel Cron every Monday at 9 AM ET (14:00 UTC).
 * Sends the weekly brief email to all active Pro subscribers
 * who have pending deliverables created in the past 7 days.
 *
 * Protected by CRON_SECRET to prevent unauthorized triggering.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyBriefJob } from '@/lib/email/weekly-brief'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min — Vercel Pro limit

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyBriefJob()

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[WeeklyCron] Fatal error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
