import { NextRequest, NextResponse } from 'next/server'
import { scoreAudit } from '@/lib/scoring/engine'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { audit_id } = body

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id is required' }, { status: 400 })
    }

    // Load the raw scrape from audits table
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found', details: auditError?.message },
        { status: 404 }
      )
    }

    // Run the scoring engine
    const scoreResult = scoreAudit(audit.scrape_data)

    // Persist to audit_scores table
    const { data: existingScore } = await supabase
      .from('audit_scores')
      .select('id')
      .eq('audit_id', audit_id)
      .single()

    let persistedScore
    if (existingScore) {
      const { data, error } = await supabase
        .from('audit_scores')
        .update({
          composite_score: scoreResult.composite_score,
          category_scores: scoreResult.category_scores,
          recommendations: scoreResult.recommendations,
          scored_at: new Date().toISOString(),
        })
        .eq('audit_id', audit_id)
        .select()
        .single()

      if (error) throw error
      persistedScore = data
    } else {
      const { data, error } = await supabase
        .from('audit_scores')
        .insert({
          audit_id,
          composite_score: scoreResult.composite_score,
          category_scores: scoreResult.category_scores,
          recommendations: scoreResult.recommendations,
          scored_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      persistedScore = data
    }

    return NextResponse.json({
      success: true,
      score: {
        id: persistedScore?.id,
        audit_id,
        ...scoreResult,
      },
    })
  } catch (error) {
    console.error('Scoring error:', error)
    return NextResponse.json(
      { error: 'Failed to score audit', details: String(error) },
      { status: 500 }
    )
  }
}
