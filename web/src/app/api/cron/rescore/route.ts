/**
 * GET /api/cron/rescore
 *
 * Weekly re-score cron job. Enqueues a re-audit for every property
 * that has not been scored in the last 7 days.
 *
 * Additive route — does not modify the existing /api/cron/weekly or /api/cron/daily routes.
 * Register this in Vercel Cron: { "path": "/api/cron/rescore", "schedule": "0 6 * * 1" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRescoringDue, persistPropertyScore } from '@/lib/scoreHistory'

// Guard against unauthorized calls in production
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // dev: allow all
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all active properties
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, listing_url, title')
      .eq('active', true)

    if (error) {
      console.error('[rescore cron] Failed to fetch properties:', error.message)
      return NextResponse.json({ error: 'DB error fetching properties' }, { status: 500 })
    }

    const results: Array<{ propertyId: string; status: string }> = []

    for (const property of properties ?? []) {
      const due = await isRescoringDue(property.id)
      if (!due) {
        results.push({ propertyId: property.id, status: 'skipped_not_due' })
        continue
      }

      // Enqueue re-score task via the existing job queue
      // We call the audit API internally — this is additive and non-destructive
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const auditRes = await fetch(`${baseUrl}/api/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: property.id,
            listingUrl: property.listing_url,
            source: 'weekly_rescore',
          }),
        })

        if (!auditRes.ok) {
          const errBody = await auditRes.text()
          console.error(`[rescore cron] Audit failed for ${property.id}:`, errBody)
          results.push({ propertyId: property.id, status: 'audit_failed' })
        } else {
          const auditData = await auditRes.json()
          // If the audit API returns a score, persist it
          if (auditData?.score != null) {
            await persistPropertyScore(
              property.id,
              auditData.score,
              auditData.categoryScores ?? {}
            )
          }
          results.push({ propertyId: property.id, status: 'rescored' })
        }
      } catch (fetchErr) {
        console.error(`[rescore cron] Fetch error for ${property.id}:`, fetchErr)
        results.push({ propertyId: property.id, status: 'error' })
      }
    }

    const summary = {
      total: results.length,
      rescored: results.filter((r) => r.status === 'rescored').length,
      skipped: results.filter((r) => r.status === 'skipped_not_due').length,
      failed: results.filter((r) => r.status !== 'rescored' && r.status !== 'skipped_not_due').length,
    }

    console.log('[rescore cron] Completed:', summary)
    return NextResponse.json({ success: true, summary, results })
  } catch (err) {
    console.error('[rescore cron] Unexpected error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
