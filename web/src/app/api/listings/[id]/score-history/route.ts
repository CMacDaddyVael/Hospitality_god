import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (accessToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
  }

  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey)
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listingId = params.id

    if (!listingId) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
    }

    // Extract auth token from Authorization header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient(token)

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the listing belongs to this user
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, user_id')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch all audit scores for this listing, ordered ascending by date
    const { data: scoreHistory, error: historyError } = await supabase
      .from('listing_audits')
      .select('scored_at, total_score, category_scores')
      .eq('listing_id', listingId)
      .order('scored_at', { ascending: true })

    if (historyError) {
      console.error('Score history fetch error:', historyError)
      return NextResponse.json({ error: 'Failed to fetch score history' }, { status: 500 })
    }

    const history = scoreHistory || []

    // Compute delta: current score vs first audit score
    const firstScore = history.length > 0 ? history[0].total_score : null
    const currentScore = history.length > 0 ? history[history.length - 1].total_score : null
    const delta = firstScore !== null && currentScore !== null ? currentScore - firstScore : 0

    return NextResponse.json({
      listing_id: listingId,
      history,
      delta,
      first_score: firstScore,
      current_score: currentScore,
      count: history.length,
    })
  } catch (error) {
    console.error('Score history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
