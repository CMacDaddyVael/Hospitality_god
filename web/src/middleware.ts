import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Pro-gated routes — users must have plan = 'pro' to access these.
 * This check runs server-side on every matching request.
 */
const PRO_ROUTES = [
  '/dashboard/deliverables',
  '/dashboard/photos',
  '/dashboard/content',
  '/dashboard/schedule',
]

/**
 * Routes that require any authentication (free or pro).
 */
const AUTH_ROUTES = ['/dashboard']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if this is a Pro-gated route
  const isProRoute = PRO_ROUTES.some((route) => pathname.startsWith(route))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (!isProRoute && !isAuthRoute) {
    return NextResponse.next()
  }

  // Extract auth token from cookie (Supabase auth)
  const accessToken =
    req.cookies.get('sb-access-token')?.value ||
    req.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`)?.value

  if (!accessToken) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token and get user server-side (no client-side auth bypass possible)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // For Pro-gated routes, check subscription status server-side
    if (isProRoute) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('plan')
        .eq('id', user.id)
        .single()

      if (!userRecord || userRecord.plan !== 'pro') {
        // Redirect to upgrade page with context
        const upgradeUrl = new URL('/upgrade', req.url)
        upgradeUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(upgradeUrl)
      }
    }

    return NextResponse.next()
  } catch (err) {
    console.error('[middleware] Auth check failed:', err)
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upgrade',
  ],
}
