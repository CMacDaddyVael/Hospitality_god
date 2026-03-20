/**
 * VAEL Host — Manual Job Trigger
 * Issue #173: POST /api/admin/run-jobs
 *
 * Allows admins to manually trigger the daily job runner without waiting
 * for the cron schedule. Protected by x-admin-key header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyJobs } from '@/lib/jobs/dispatcher'

function isAuthorized(req: NextRequest): boolean {
  const adminKey = req.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY

  if (!expectedKey) {
    console.warn('[AdminRunJobs] ADMIN_API_KEY not set — rejecting all requests')
    return false
  }

  return adminKey === expectedKey
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized — x-admin-key header required' }, { status: 401 })
  }

  // Parse optional filters from body
  let filters: { propertyId?: string; jobType?: string; dryRun?: boolean } = {}
  try {
    const body = await req.json()
    filters = body || {}
  } catch {
    // No body is fine
  }

  const startedAt = new Date()
  console.log(`[AdminRunJobs] Manual trigger at ${startedAt.toISOString()}`, filters)

  try {
    const result = await runDailyJobs({
      propertyId: filters.propertyId,
      jobType: filters.jobType as any,
      dryRun: filters.dryRun ?? false,
    })

    const duration = Date.now() - startedAt.getTime()

    return NextResponse.json({
      success: true,
      manual: true,
      triggeredAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration,
      summary: result.summary,
      runs: result.runs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[AdminRunJobs] Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
