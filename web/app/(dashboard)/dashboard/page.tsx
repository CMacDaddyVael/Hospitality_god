import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DashboardOverview } from '@/components/dashboard/DashboardOverview'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user's listings
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <DashboardOverview user={user!} listings={listings ?? []} />
}
