import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListingOptimizerView } from '@/components/listing/ListingOptimizerView'

type Props = {
  params: { propertyId: string }
}

export default async function ListingPage({ params }: Props) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: property, error } = await supabase
    .from('properties')
    .select(
      'id, title, description, amenities, photos, location, property_type, price_per_night, optimized_listing, optimization_run_at, optimization_approved'
    )
    .eq('id', params.propertyId)
    .eq('user_id', user.id)
    .single()

  if (error || !property) redirect('/dashboard')

  // Fetch most recent optimization task for token cost + status
  const { data: lastTask } = await supabase
    .from('agent_tasks')
    .select('id, status, token_cost, started_at, completed_at')
    .eq('property_id', params.propertyId)
    .eq('task_type', 'listing_optimization')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ListingOptimizerView
      property={property}
      lastTask={lastTask ?? null}
    />
  )
}
