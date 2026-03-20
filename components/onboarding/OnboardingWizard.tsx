'use client'

import { useState, useEffect, useCallback } from 'react'
import { Step1ListingUrl } from './steps/Step1ListingUrl'
import { Step2VoiceCalibration } from './steps/Step2VoiceCalibration'
import { Step3Connections } from './steps/Step3Connections'
import { Step4Plan } from './steps/Step4Plan'
import { CompletionScreen } from './CompletionScreen'
import { WizardProgress } from './WizardProgress'
import { generateSessionId, loadSession, saveSession } from '@/lib/session'

export type ListingData = {
  url: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: { text: string; rating: number; date: string }[]
  rating: number
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number
  platform: 'airbnb' | 'vrbo'
}

export type VoiceData = {
  tone: 'casual' | 'professional' | 'warm' | 'luxury'
  signOffName: string
  alwaysUse: string
  neverUse: string
  personalityNotes: string
}

export type ConnectionsData = {
  instagramConnected: boolean
  instagramUsername?: string
  instagramToken?: string
  airbnbSessionCookie?: string
  metaConnected: boolean
}

export type PlanData = {
  plan: 'starter' | 'pro' | 'agency'
  billingCycle: 'monthly' | 'annual'
  trialSelected: boolean
}

export type OnboardingData = {
  listing?: ListingData
  voice?: VoiceData
  connections?: ConnectionsData
  plan?: PlanData
}

const STEPS = [
  { id: 1, label: 'Your Listing', description: 'Connect your property' },
  { id: 2, label: 'Your Voice', description: 'How you communicate' },
  { id: 3, label: 'Connect Accounts', description: 'Instagram & automation' },
  { id: 4, label: 'Choose Plan', description: 'Start your agent' },
]

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [sessionId, setSessionId] = useState<string>('')
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [isComplete, setIsComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize session and restore progress
  useEffect(() => {
    const initSession = async () => {
      let sid = localStorage.getItem('hg_session_id')
      if (!sid) {
        sid = generateSessionId()
        localStorage.setItem('hg_session_id', sid)
      }
      setSessionId(sid)

      // Try to restore saved progress
      try {
        const saved = await loadSession(sid)
        if (saved) {
          setOnboardingData(saved.data || {})
          setCurrentStep(saved.step || 1)
          if (saved.step === 'complete') {
            setIsComplete(true)
          }
        }
      } catch (err) {
        console.log('No saved session found, starting fresh')
      }

      setIsLoading(false)
    }

    initSession()
  }, [])

  // Persist progress whenever data changes
  const persistProgress = useCallback(
    async (step: number, data: OnboardingData) => {
      if (!sessionId) return
      try {
        await saveSession(sessionId, step, data)
      } catch (err) {
        console.error('Failed to save progress:', err)
      }
    },
    [sessionId]
  )

  const handleStep1Complete = useCallback(
    (listing: ListingData) => {
      const newData = { ...onboardingData, listing }
      setOnboardingData(newData)
      setCurrentStep(2)
      persistProgress(2, newData)
    },
    [onboardingData, persistProgress]
  )

  const handleStep2Complete = useCallback(
    (voice: VoiceData) => {
      const newData = { ...onboardingData, voice }
      setOnboardingData(newData)
      setCurrentStep(3)
      persistProgress(3, newData)
    },
    [onboardingData, persistProgress]
  )

  const handleStep3Complete = useCallback(
    (connections: ConnectionsData) => {
      const newData = { ...onboardingData, connections }
      setOnboardingData(newData)
      setCurrentStep(4)
      persistProgress(4, newData)
    },
    [onboardingData, persistProgress]
  )

  const handleStep4Complete = useCallback(
    async (plan: PlanData) => {
      const newData = { ...onboardingData, plan }
      setOnboardingData(newData)

      try {
        const response = await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, onboardingData: newData }),
        })

        if (response.ok) {
          setIsComplete(true)
          persistProgress('complete' as any, newData)
        }
      } catch (err) {
        console.error('Failed to complete onboarding:', err)
        // Still show completion screen even if API fails
        setIsComplete(true)
      }
    },
    [onboardingData, sessionId, persistProgress]
  )

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your session...</p>
        </div>
      </div>
    )
  }

  if (isComplete) {
    return <CompletionScreen sessionId={sessionId} onboardingData={onboardingData} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-slate-900 font-bold text-sm">VH</span>
          </div>
          <span className="text-white font-semibold">VAEL Host</span>
        </div>
        <div className="text-slate-400 text-sm">
          Step {currentStep} of {STEPS.length}
        </div>
      </header>

      {/* Progress */}
      <WizardProgress steps={STEPS} currentStep={currentStep} />

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          {currentStep === 1 && (
            <Step1ListingUrl
              initialData={onboardingData.listing}
              onComplete={handleStep1Complete}
            />
          )}
          {currentStep === 2 && (
            <Step2VoiceCalibration
              initialData={onboardingData.voice}
              listingData={onboardingData.listing}
              onComplete={handleStep2Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <Step3Connections
              initialData={onboardingData.connections}
              onComplete={handleStep3Complete}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <Step4Plan
              initialData={onboardingData.plan}
              onComplete={handleStep4Complete}
              onBack={handleBack}
              sessionId={sessionId}
            />
          )}
        </div>
      </main>
    </div>
  )
}
