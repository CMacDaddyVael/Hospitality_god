import { NextRequest, NextResponse } from 'next/server'
import { buildFakeAudit } from '@/lib/fake-audit'

/**
 * Dev-only seed endpoint.
 * GET /api/audit/seed          → seeds a "demo" audit and redirects to /audit/demo
 * GET /api/audit/seed?id=foo   → seeds audit with id "foo"
 * GET /api/audit/seed?score=72 → seeds audit with a custom overall score
 *
 * This endpoint stores the seeded audit in the Supabase DB if configured,
 * or returns the fake data as JSON for inspection.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || 'demo'
  const scoreParam = searchParams.get('score')
  const redirect = searchParams.get('redirect') !== 'false'

  const audit = buildFakeAudit(id)

  // Allow overriding the overall score for testing color states
  if (scoreParam) {
    const score = parseInt(scoreParam, 10)
    if (!isNaN(score) && score >= 0 && score <= 100) {
      audit.overall_score = score
    }
  }

  // Try to persist to Supabase if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })

      await supabase.from('audit_results').upsert(
        {
          id: audit.id,
          created_at: audit.created_at,
          listing_url: audit.listing_url,
          listing_title: audit.listing_title,
          overall_score: audit.overall_score,
          categories: audit.categories,
          recommendations: audit.recommendations,
          property_type: audit.property_type,
          location: audit.location,
        },
        { onConflict: 'id' }
      )
    } catch (err) {
      console.error('Failed to seed Supabase:', err)
    }
  }

  if (redirect) {
    return NextResponse.redirect(new URL(`/audit/${id}`, req.url))
  }

  return NextResponse.json({ success: true, audit })
}
