import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Fetch subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Fetch deliverables (most recent 50)
    const { data: deliverables, error: delError } = await supabase
      .from('deliverables')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (delError) {
      console.error('Deliverables fetch error:', delError)
    }

    // Fetch listing scores (last 4 weeks)
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: scoreHistory, error: scoreError } = await supabase
      .from('listing_scores')
      .select('score, scored_at, listing_url')
      .eq('user_id', userId)
      .gte('scored_at', fourWeeksAgo.toISOString())
      .order('scored_at', { ascending: true })

    if (scoreError) {
      console.error('Score history fetch error:', scoreError)
    }

    // Current score is the most recent
    const currentScore =
      scoreHistory && scoreHistory.length > 0
        ? scoreHistory[scoreHistory.length - 1].score
        : null

    // Count pending deliverables
    const pendingCount = (deliverables || []).filter((d) => d.status === 'pending').length

    return NextResponse.json({
      success: true,
      subscription: subscription || null,
      deliverables: deliverables || [],
      scoreHistory: scoreHistory || [],
      currentScore,
      pendingCount,
    })
  } catch (error) {
    console.error('Dashboard data error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
