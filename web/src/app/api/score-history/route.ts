/**
 * GET /api/score-history?propertyId=<uuid>
 *
 * Returns the full score history and monthly summary for a property.
 * New additive route — does not touch any existing API routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPropertyScoreHistory,
  computeScoreHistorySummary,
} from '@/lib/scoreHistory'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId query param is required' },
        { status: 400 }
      )
    }

    const records = await getPropertyScoreHistory(propertyId)
    const summary = computeScoreHistorySummary(records)

    return NextResponse.json({ success: true, ...summary })
  } catch (err) {
    console.error('[score-history API] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch score history' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/score-history
 *
 * Body: { propertyId, score, categoryScores? }
 * Persists a new score record. Called by the scoring engine and weekly cron.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { propertyId, score, categoryScores = {} } = body

    if (!propertyId || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'propertyId and numeric score are required' },
        { status: 400 }
      )
    }

    if (score < 0 || score > 100) {
      return NextResponse.json(
        { error: 'score must be between 0 and 100' },
        { status: 400 }
      )
    }

    const { persistPropertyScore } = await import('@/lib/scoreHistory')
    const record = await persistPropertyScore(propertyId, score, categoryScores)

    if (!record) {
      return NextResponse.json(
        { error: 'Failed to persist score record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, record }, { status: 201 })
  } catch (err) {
    console.error('[score-history API] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to persist score' },
      { status: 500 }
    )
  }
}
