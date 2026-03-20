import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

/**
 * GET /api/auth/callback
 * Handles the OAuth / magic-link callback from Supabase Auth.
 * Exchanges the code for a session, then redirects the user back
 * to wherever they came from (preserved in `next` query param).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] Exchange error:', error)
  }

  // If something went wrong, send user to audit page with an error flag
  return NextResponse.redirect(`${origin}/audit?error=auth_callback_failed`)
}
