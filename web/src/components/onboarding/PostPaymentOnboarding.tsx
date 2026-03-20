'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { OnboardingStepListings } from './steps/OnboardingStepListings'
import { OnboardingStepModules } from './steps/OnboardingStepModules'
import { OnboardingStepConfirmation } from './steps/OnboardingStepConfirmation'
import { OnboardingProgressBar } from './OnboardingProgressBar'

export type ListingEntry = {
  url: string
  platform: 'airbnb' | 'vrbo' | 'other'
  valid: boolean
}

export type ModuleId =
  | 'social_content'
  | 'listing_optimization'
  | 'review_responses'
  | 'seasonal_updates'
  | 'guest_messaging'
  | 'competitive_analysis'

export type OnboardingState = {
  step: 1 | 2 | 3
  listings: ListingEntry[]
  modules: ModuleId[]
  completed: boolean
}

const INITIAL_STATE: OnboardingState = {
  step: 1,
  listings: [],
  modules: [
    'social_content',
    'listing_optimization',
    'review_responses',
    'seasonal_updates',
    'guest_messaging',
    'competitive_analysis',
  ],
  completed: false,
}

const STEPS = [
  { id: 1, label: 'Your Properties' },
  { id: 2, label: 'Active Modules' },
  { id: 3, label: 'All Set!' },
]

export function PostPaymentOnboarding() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // userId can come from Supabase session or query param from Stripe redirect
  const userIdParam = searchParams.get('userId') || searchParams.get('user_id')
  const sessionParam = searchParams.get('session_id') // Stripe checkout session ID

  const [userId, setUserId] = useState<string | null>(userIdParam)
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Resolve userId from Supabase auth if not in query params
  useEffect(() => {
    const resolveUser = async () => {
      if (userId) {
        setIsLoading(false)
        return
      }

      // Try to get from Supabase client session
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setUserId(user.id)
        }
      } catch (err) {
        console.error('Could not resolve user:', err)
      }

      setIsLoading(false)
    }

    resolveUser()
  }, [userId])

  // Load saved progress once userId is known
  useEffect(() => {
    if (!userId || isLoading) return

    const loadProgress = async () => {
      try {
        const res = await fetch(`/api/onboarding/save-progress?userId=${userId}`)
        const json = await res.json()

        if (json.success && json.progress) {
          const saved = json.progress
          if (saved.current_step === 'complete') {
            // Already completed — redirect to dashboard
            router.replace('/dashboard')
            return
          }

          if (saved.step_data) {
            setState((prev) => ({
              ...prev,
              step: (saved.current_step as 1 | 2 | 3) || 1,
              listings: saved.step_data.listings || prev.listings,
              modules: saved.step_data.modules || prev.modules,
            }))
          }
        }
      } catch (err) {
        console.error('Failed to load onboarding progress:', err)
      }
    }

    loadProgress()
  }, [userId, isLoading, router])

  const persistProgress = useCallback(
    async (newState: OnboardingState) => {
      if (!userId) return

      try {
        await fetch('/api/onboarding/save-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            step: newState.step,
            data: {
              listings: newState.listings,
              modules: newState.modules,
            },
          }),
        })
      } catch (err) {
        console.error('Failed to persist progress:', err)
        // Non-fatal — continue
      }
    },
    [userId]
  )

  const goToStep = useCallback(
    (step: 1 | 2 | 3, updatedState?: Partial<OnboardingState>) => {
      setState((prev) => {
        const next = { ...prev, ...updatedState, step }
        persistProgress(next)
        return next
      })
    },
    [persistProgress]
  )

  const handleStep1Complete = useCallback(
    (listings: ListingEntry[]) => {
      goToStep(2, { listings })
    },
    [goToStep]
  )

  const handleStep2Complete = useCallback(
    (modules: ModuleId[]) => {
      goToStep(3, { modules })
    },
    [goToStep]
  )

  const handleFinalComplete = useCallback(async () => {
    if (!userId) return

    setIsSaving(true)

    try {
      const validUrls = state.listings
        .filter((l) => l.valid)
        .map((l) => l.url)

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          listingUrls: validUrls,
          selectedModules: state.modules,
        }),
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'Failed to complete onboarding')
      }

      setState((prev) => ({ ...prev, completed: true }))
    } catch (err) {
      console.error('Complete onboarding error:', err)
    } finally {
      setIsSaving(false)
    }
  }, [userId, state.listings, state.modules])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading your setup...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-lg tracking-tight">VAEL Host</span>
          <span className="hidden sm:block text-slate-600">|</span>
          <span className="hidden sm:block text-slate-400 text-sm">Property Setup</span>
        </div>
        {userId && (
          <span className="text-slate-500 text-xs">
            Step {state.step} of {STEPS.length}
          </span>
        )}
      </header>

      {/* Progress bar */}
      <OnboardingProgressBar steps={STEPS} currentStep={state.step} />

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl">
          {state.step === 1 && (
            <OnboardingStepListings
              initialListings={state.listings}
              onComplete={handleStep1Complete}
            />
          )}
          {state.step === 2 && (
            <OnboardingStepModules
              initialModules={state.modules}
              onBack={() => goToStep(1)}
              onComplete={handleStep2Complete}
            />
          )}
          {state.step === 3 && (
            <OnboardingStepConfirmation
              listings={state.listings}
              modules={state.modules}
              isCompleting={isSaving}
              isCompleted={state.completed}
              onBack={() => goToStep(2)}
              onComplete={handleFinalComplete}
              userId={userId}
            />
          )}
        </div>
      </main>
    </div>
  )
}
