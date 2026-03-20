import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params

    const { data, error } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Audit session not found' }, { status: 404 })
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This audit link has expired. Run a new audit to see your score.' },
        { status: 410 }
      )
    }

    return NextResponse.json({ success: true, audit: data })
  } catch (error) {
    console.error('Audit session fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 })
  }
}
