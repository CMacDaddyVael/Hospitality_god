/**
 * POST /api/listing-optimization
 *
 * Invokable from:
 *  - Onboarding complete route (#171)
 *  - Cron job runner (#173)
 *  - Direct API calls
 *
 * Accepts a canonical property object + audit score breakdown,
 * runs the optimization pipeline, and returns the deliverable ID + payload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runListingOptimizationPipeline } from '../../../../lib/queue/workers/listing-optimization'
import type { PropertyObject, AuditScoreBreakdown } from '../../../../lib/queue/workers/listing-optimization'

// ─── Request validation ───────────────────────────────────────────────────────

function validateProperty(obj: unknown): obj is PropertyObject {
  if (!obj || typeof obj !== 'object') return false
  const p = obj as Record<string, unknown>
  return (
    typeof p.url === 'string' &&
    typeof p.title === 'string' &&
    typeof p.description === 'string' &&
    Array.isArray(p.amenities) &&
    typeof p.location === 'string' &&
    typeof p.propertyType === 'string' &&
    typeof p.pricePerNight === 'number'
  )
}

function validateAudit(obj: unknown): obj is AuditScoreBreakdown {
  if (!obj || typeof obj !== 'object') return false
  const a = obj as Record<string, unknown>
  return typeof a.overall === 'number'
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { property, audit, sessionId, propertyId } = body

    // Validate required inputs
    if (!validateProperty(property)) {
      return NextResponse.json(
        {
          error: 'Invalid property object. Required fields: url, title, description, amenities (array), location, propertyType, pricePerNight.',
        },
        { status: 400 }
      )
    }

    if (!validateAudit(audit)) {
      return NextResponse.json(
        {
          error: 'Invalid audit object. Required field: overall (number 0-100).',
        },
        { status: 400 }
      )
    }

    console.log(
      `[api/listing-optimization] Request received — session: ${sessionId ?? 'none'}, property: ${property.title}`
    )

    // Run the optimization pipeline
    const result = await runListingOptimizationPipeline({
      property,
      audit,
      sessionId,
      propertyId,
    })

    return NextResponse.json({
      success: true,
      deliverableId: result.deliverableId,
      payload: result.payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/listing-optimization] Pipeline error:', message)

    return NextResponse.json(
      {
        error: 'Listing optimization pipeline failed.',
        details: message,
      },
      { status: 500 }
    )
  }
}

// ─── GET: Retrieve a deliverable by ID ───────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const deliverableId = searchParams.get('id')
    const sessionId = searchParams.get('sessionId')

    if (!deliverableId && !sessionId) {
      return NextResponse.json(
        { error: 'Provide either id or sessionId query parameter.' },
        { status: 400 }
      )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('deliverables')
      .select('*')
      .eq('type', 'listing_optimization')
      .order('created_at', { ascending: false })

    if (deliverableId) {
      query = query.eq('id', deliverableId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true, deliverables: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/listing-optimization] GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
