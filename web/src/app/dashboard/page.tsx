import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
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

  // These will be empty arrays on first load — shell handles empty states
  const [contentResult, propertiesResult, scoresResult] = await Promise.all([
    supabase
      .from('content')
      .select('*')
      .eq('user_id', user!.id)
      .in('status', ['pending', 'approved', 'dismissed'])
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('properties')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true }),

    supabase
      .from('audit_scores')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <DashboardShell
      userId={user!.id}
      initialContent={contentResult.data ?? []}
      initialProperties={propertiesResult.data ?? []}
      auditScores={scoresResult.data ?? []}
    />
  )
}
