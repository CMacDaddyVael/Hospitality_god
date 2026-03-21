import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/subscriber/preferences
 *
 * Returns current preferences for the authenticated subscriber.
 * Requires ?subscriber_id= query param (used by dashboard before full auth is wired).
 * When Supabase Auth is fully integrated, this will use the JWT from the session.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const subscriberId = searchParams.get('subscriber_id')

    // Attempt to read authenticated user from Supabase Auth header
    // If present, it takes precedence over the query param
    const authHeader = req.headers.get('authorization')
    let resolvedSubscriberId = subscriberId

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: userData, error: authError } = await supabase.auth.getUser(token)
      if (!authError && userData?.user) {
        resolvedSubscriberId = userData.user.id
      }
    }

    if (!resolvedSubscriberId) {
      return NextResponse.json(
        { error: 'subscriber_id is required (query param or Authorization header)' },
        { status: 400 }
      )
    }

    const { data: preferences, error } = await supabase
      .from('subscriber_preferences')
      .select('subscriber_id, modules, property_urls, voice_sample, created_at, updated_at')
      .eq('subscriber_id', resolvedSubscriberId)
      .maybeSingle()

    if (error) {
      console.error('[preferences] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      )
    }

    if (!preferences) {
      return NextResponse.json(
        { error: 'No preferences found for this subscriber' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (error) {
    console.error('[preferences] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
