/**
 * POST /api/listing-optimization/[contentId]/approve
 *
 * Marks a content item as approved and records the approval timestamp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  try {
    const { contentId } = params

    if (!contentId) {
      return NextResponse.json({ error: 'contentId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single()

    if (error) {
      console.error('[approve] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to approve content item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, content: data })
  } catch (error) {
    console.error('[approve] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
