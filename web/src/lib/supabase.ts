/**
 * Supabase client — single shared module.
 * All Supabase access flows through here. Never instantiate the client elsewhere.
 *
 * Three exports:
 *  - createBrowserClient()  → use in Client Components ('use client')
 *  - createServerClient()   → use in Server Components, Route Handlers, Middleware
 *  - createAdminClient()    → use only in trusted server contexts (service role)
 */

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Copy web/.env.example to web/.env.local and fill in your project credentials.'
  )
}

// ─── Browser client (Client Components) ──────────────────────────────────────

export function createBrowserClient() {
  return _createBrowserClient(supabaseUrl, supabaseAnon)
}

// ─── Server client (Server Components, Route Handlers, Middleware) ────────────

export async function createServerClient() {
  const cookieStore = await cookies()

  return _createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component — cookies can't be set.
          // Middleware handles session refresh, so this is safe to ignore.
        }
      },
    },
  })
}

// ─── Admin client (service role — server only, never expose to client) ────────

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'This client should only be used in trusted server contexts.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
