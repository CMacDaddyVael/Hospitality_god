'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SubscriberWizardProgress } from './SubscriberWizardProgress'
import { StepDeliverableCategories } from './steps/StepDeliverableCategories'
import { StepPropertyVibe } from './steps/StepPropertyVibe'
import { StepVoiceSamples } from './steps/StepVoiceSamples'
import { SubscriberOnboardingComplete } from './SubscriberOnboardingComplete'

export type DeliverableCategory =
  | 'social_content'
  | 'listing_optimization'
  | 'review_responses'
  | 'seasonal_updates'

export type VibeKeyword =
  | 'cozy_cabin'
  | 'luxury_beachfront'
  | 'family_friendly'
  | 'romantic_getaway'
  | 'adventure_basecamp'
  | 'urban_chic'
  | 'mountain_retreat'
  | 'lakeside_escape'
  | 'pet_friendly_haven'
  | 'remote_work_ready'
  | 'boho_bungalow'
  | 'modern_minimalist'

export type SubscriberPreferences = {
  deliverableCategories: DeliverableCategory[]
  vibeKeywords: VibeKeyword[]
  brandNotes: string
  voiceSamples: string
}

export const DEFAULT_PREFERENCES: SubscriberPreferences = {
  deliverableCategories: ['social_content', 'listing_optimization', 'review_responses', 'seasonal_updates'],
  vibeKeywords: [],
  brandNotes: '',
  voiceSamples: '',
}

const STEPS = [
  { id: 1, label: 'Content Focus', description: 'What we create for you' },
  { id: 2, label: 'Property Vibe', description: 'Your brand & style' },
  { id: 3, label: 'Your Voice', description: 'How you sound' },
]

export function SubscriberOnboarding() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentStep, setCurrentStep] = useState(1)
  const [preferences, setPreferences] = useState<SubscriberPreferences>(DEFAULT_PREFERENCES)
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Extract session/subscriber info from Stripe redirect
  const sessionId = searchParams.get('session_id') || searchParams.get('session') || ''
  const userId = searchParams.get('user_id') || ''

  const handleCategoriesComplete = useCallback((categories: DeliverableCategory[]) => {
    setPreferences((prev) => ({ ...prev, deliverableCategories: categories }))
    setCurrentStep(2)
  }, [])

  const handleVibeComplete = useCallback((keywords: VibeKeyword[], brandNotes: string) => {
    setPreferences((prev) => ({ ...prev, vibeKeywords: keywords, brandNotes }))
    setCurrentStep(3)
  }, [])

  const handleVoiceComplete = useCallback(async (voiceSamples: string) => {
    const finalPreferences = { ...preferences, voiceSamples }
    setPreferences(finalPreferences)
    await submitOnboarding(finalPreferences, false)
  }, [preferences, sessionId, userId])

  const handleSkip = useCallback(async () => {
    await submitOnboarding(preferences, true)
  }, [preferences, sessionId, userId])

  const submitOnboarding = async (
    finalPreferences: SubscriberPreferences,
    skipped: boolean
  ) => {
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/subscriber-onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          preferences: finalPreferences,
          skipped,
          completedStep: currentStep,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save preferences')
      }

      setIsComplete(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoToDashboard = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  if (isComplete) {
    return <SubscriberOnboardingComplete onGoToDashboard={handleGoToDashboard} />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-4">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
              Welcome to VAEL Host
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Set up your AI marketing team
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            Takes 2 minutes. The more we know, the better your first deliverables.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
          {/* Progress */}
          <SubscriberWizardProgress steps={STEPS} currentStep={currentStep} />

          {/* Step content */}
          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {currentStep === 1 && (
              <StepDeliverableCategories
                initialCategories={preferences.deliverableCategories}
                onComplete={handleCategoriesComplete}
                onSkip={handleSkip}
                isSubmitting={isSubmitting}
              />
            )}

            {currentStep === 2 && (
              <StepPropertyVibe
                initialKeywords={preferences.vibeKeywords}
                initialBrandNotes={preferences.brandNotes}
                onComplete={handleVibeComplete}
                onBack={() => setCurrentStep(1)}
                onSkip={handleSkip}
                isSubmitting={isSubmitting}
              />
            )}

            {currentStep === 3 && (
              <StepVoiceSamples
                initialSamples={preferences.voiceSamples}
                onComplete={handleVoiceComplete}
                onBack={() => setCurrentStep(2)}
                onSkip={handleSkip}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-600 text-xs mt-6">
          You can update these preferences anytime from your dashboard settings.
        </p>
      </div>
    </div>
  )
}
