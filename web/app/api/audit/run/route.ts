import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/engine'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { url, propertyId, userId } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Create a pending audit record
    const { data: auditRecord, error: insertError } = await supabase
      .from('website_audits')
      .insert({
        url: parsedUrl.toString(),
        property_id: propertyId || null,
        user_id: userId || null,
        status: 'running',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create audit record:', insertError)
      return NextResponse.json({ error: 'Failed to initialize audit' }, { status: 500 })
    }

    // Run audit asynchronously but wait up to 55s
    try {
      const results = await runAudit(parsedUrl.toString())

      const { data: updated } = await supabase
        .from('website_audits')
        .update({
          status: 'complete',
          results,
          overall_score: results.overallScore,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditRecord.id)
        .select()
        .single()

      return NextResponse.json({ success: true, audit: updated })
    } catch (auditError) {
      console.error('Audit engine error:', auditError)
      await supabase
        .from('website_audits')
        .update({ status: 'failed', error: String(auditError) })
        .eq('id', auditRecord.id)

      return NextResponse.json({ error: 'Audit failed', auditId: auditRecord.id }, { status: 500 })
    }
  } catch (error) {
    console.error('Audit route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
