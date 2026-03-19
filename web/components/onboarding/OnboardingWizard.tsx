'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WizardProgress } from './WizardProgress'
import { Step1ListingUrl } from './steps/Step1ListingUrl'
import { Step2ConfirmListing } from './steps/Step2ConfirmListing'
import { Step3VoiceCalibration } from './steps/Step3VoiceCalibration'
import { Step4Confirmation } from './steps/Step4Confirmation'

export type ListingData = {
  url: string
  listingId: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: Array<{ text: string; rating: number; date: string; authorName?: string }>
  rating: number
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number
  platform: 'airbnb' | 'vrbo'
  beds?: number
  baths?: number
  maxGuests?: number
  // Manual entry fallback
  isManualEntry?: boolean
}

export type VoiceProfile = {
  examples: string[]   // 2-3 samples of how they talk to guests
  tone: 'casual' | 'professional' | 'warm' | 'luxury'
  signOffName: string  // e.g. "Sarah" or "The Maple Cottage Team"
  alwaysUse: string    // phrases to always include
  neverUse: string     // phrases to never include
  personalityNotes: string
}

export type OnboardingState = {
  listing?: ListingData
  voice?: VoiceProfile
}

const STEPS = [
  { id: 1, label: 'Your Listing', description: 'Connect your property' },
  { id: 2, label: 'Confirm Details', description: 'Review imported data' },
  { id: 3, label: 'Your Voice', description: 'How you talk to guests' },
  { id: 4, label: 'Launch', description: 'Start your agent' },
]

type Props = {
  userId: string
  userEmail: string
}

export function OnboardingWizard({ userId, userEmail }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingState>({})
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionError, setCompletionError] = useState('')

  const handleStep1Complete = useCallback((listing: ListingData) => {
    setData((prev) => ({ ...prev, listing }))
    setCurrentStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleStep2Complete = useCallback((listing: ListingData) => {
    setData((prev) => ({ ...prev, listing }))
    setCurrentStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleStep3Complete = useCallback((voice: VoiceProfile) => {
    setData((prev) => ({ ...prev, voice }))
    setCurrentStep(4)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleComplete = useCallback(async () => {
    setIsCompleting(true)
    setCompletionError('')
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          listing: data.listing,
          voice: data.voice,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to complete onboarding')
      }

      // Redirect to dashboard — agent tasks are already queued
      router.push('/dashboard?onboarding=complete')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setCompletionError(msg)
      setIsCompleting(false)
    }
  }, [data, userId, router])

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentStep])

  return (
    <div className="w-full max-w-2xl">
      {/* Card */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 shadow-2xl backdrop-blur-sm overflow-hidden">
        {/* Progress */}
        <WizardProgress steps={STEPS} currentStep={currentStep} />

        {/* Step content */}
        <div className="p-6 md:p-8">
          {currentStep === 1 && (
            <Step1ListingUrl
              initialData={data.listing}
              onComplete={handleStep1Complete}
            />
          )}
          {currentStep === 2 && data.listing && (
            <Step2ConfirmListing
              listing={data.listing}
              onComplete={handleStep2Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <Step3VoiceCalibration
              initialData={data.voice}
              propertyName={data.listing?.title}
              onComplete={handleStep3Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <Step4Confirmation
              listing={data.listing!}
              voice={data.voice!}
              onComplete={handleComplete}
              onBack={handleBack}
              isLoading={isCompleting}
              error={completionError}
            />
          )}
        </div>
      </div>

      {/* Step count */}
      <p className="mt-4 text-center text-xs text-slate-500">
        Step {currentStep} of {STEPS.length}
      </p>
    </div>
  )
}
