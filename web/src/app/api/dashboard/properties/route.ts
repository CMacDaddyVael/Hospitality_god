import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { properties } = body // array of { id?, platform, url, nickname }

  if (!Array.isArray(properties) || properties.length > 3) {
    return NextResponse.json({ error: 'Invalid properties data' }, { status: 400 })
  }

  // Validate URLs
  const validPlatforms = ['airbnb', 'vrbo', 'website', 'other']
  for (const prop of properties) {
    if (!prop.url || !prop.platform) {
      return NextResponse.json({ error: 'Each property needs a URL and platform' }, { status: 400 })
    }
    if (!validPlatforms.includes(prop.platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }
    try {
      new URL(prop.url)
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${prop.url}` }, { status: 400 })
    }
  }

  // Delete existing and re-insert (simple upsert pattern)
  const { error: deleteError } = await supabase
    .from('properties')
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (properties.length === 0) {
    return NextResponse.json({ success: true, properties: [] })
  }

  const rows = properties.map((p) => ({
    user_id: user.id,
    platform: p.platform,
    url: p.url.trim(),
    nickname: p.nickname?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('properties')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, properties: data })
}
