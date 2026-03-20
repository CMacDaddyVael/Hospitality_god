import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyBriefPipeline } from '@/lib/email/weekly-brief-pipeline'

/**
 * Weekly brief cron endpoint
 * Called by Vercel Cron every Monday at 8am UTC
 * vercel.json configures per-owner timezone offsetting via the pipeline
 *
 * Protected by CRON_SECRET to prevent unauthorized triggering
 */
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes — enough for a full owner sweep

export async function GET(req: NextRequest) {
  // Verify this is a legitimate cron call
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyBriefPipeline()
    return NextResponse.json({
      success: true,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    })
  } catch (error) {
    console.error('[weekly-brief] Fatal pipeline error:', error)
    return NextResponse.json(
      {
        error: 'Pipeline failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers / testing
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let ownerIdFilter: string | undefined
  try {
    const body = await req.json()
    ownerIdFilter = body.ownerId // Optional: run for a single owner (useful for testing)
  } catch {
    // No body is fine
  }

  try {
    const result = await runWeeklyBriefPipeline({ ownerIdFilter })
    return NextResponse.json({
      success: true,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      details: result.details,
    })
  } catch (error) {
    console.error('[weekly-brief] Fatal pipeline error:', error)
    return NextResponse.json(
      {
        error: 'Pipeline failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
