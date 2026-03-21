import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deliverable_id, user_id } = body

    if (!deliverable_id || !user_id) {
      return NextResponse.json(
        { error: 'deliverable_id and user_id are required' },
        { status: 400 }
      )
    }

    // Verify the deliverable belongs to the user before updating
    const { data: deliverable, error: fetchError } = await supabase
      .from('deliverables')
      .select('id, user_id, status')
      .eq('id', deliverable_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (fetchError || !deliverable) {
      return NextResponse.json(
        { error: 'Deliverable not found or access denied' },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabase
      .from('deliverables')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliverable_id)
      .eq('user_id', user_id)

    if (updateError) {
      console.error('Supabase update error:', updateError)
      return NextResponse.json({ error: 'Failed to approve deliverable' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: 'approved' })
  } catch (error) {
    console.error('Approve deliverable error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
