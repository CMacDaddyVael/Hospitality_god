import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Get Started — Hospitality God',
  description: 'Connect your property and launch your AI marketing agent',
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if already onboarded
  const { data: owner } = await supabase
    .from('owners')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .single()

  if (owner?.onboarding_completed_at) {
    redirect('/dashboard')
  }

  return <OnboardingWizard userId={user.id} userEmail={user.email ?? ''} />
}
