import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Dashboard middleware — protects all /dashboard routes.
 *
 * Rules:
 *  1. Unauthenticated users → redirect to / (landing + audit CTA)
 *  2. Authenticated users with subscription_status !== 'active' → redirect to
 *     /subscribe so they can start/restart their subscription
 *  3. Authenticated users with an active subscription → pass through
 *
 * The Stripe webhook handler keeps `profiles.subscription_status` in sync, so
 * this check is always current.
 */

const DASHBOARD_PREFIX = '/dashboard'
const LANDING_URL = '/'
const SUBSCRIBE_URL = '/subscribe'
// Routes inside dashboard that don't require an active subscription
// (e.g., a billing portal page the user must be able to reach even if lapsed)
const SUBSCRIPTION_EXEMPT_PATHS = ['/dashboard/billing']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only run on dashboard routes
  if (!pathname.startsWith(DASHBOARD_PREFIX)) {
    return NextResponse.next()
  }

  // Allow access to billing page even for inactive subscribers so they can
  // manage/reactivate their subscription without being bounced in a loop.
  if (SUBSCRIPTION_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  // Build a Supabase SSR client that reads cookies from the request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in — send to landing page
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = LANDING_URL
    redirectUrl.searchParams.set('reason', 'auth_required')
    return NextResponse.redirect(redirectUrl)
  }

  // Check subscription status
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[middleware] Failed to fetch profile:', error.message)
    // On DB error, let them through — we fail open to avoid locking out valid
    // paying customers due to a transient DB issue.
    return res
  }

  const isActive = profile?.subscription_status === 'active'

  if (!isActive) {
    // Paid gating — send to subscribe page with context
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = SUBSCRIBE_URL
    redirectUrl.searchParams.set('reason', 'subscription_required')
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all /dashboard routes but NOT:
     * - API routes (/api/*)
     * - Static files (_next/static, _next/image, favicon.ico)
     */
    '/dashboard/:path*',
  ],
}
