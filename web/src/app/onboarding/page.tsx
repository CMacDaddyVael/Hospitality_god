import { Suspense } from 'react'
import { PostPaymentOnboarding } from '@/components/onboarding/PostPaymentOnboarding'

export const metadata = {
  title: 'Get Started — VAEL Host',
  description: 'Set up your properties and activate your AI marketing team',
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoadingShell />}>
      <PostPaymentOnboarding />
    </Suspense>
  )
}

function OnboardingLoadingShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading your onboarding...</p>
      </div>
    </div>
  )
}
