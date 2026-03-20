'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { VoiceProgress } from './VoiceProgress'
import { StepHostingStyle } from './steps/StepHostingStyle'
import { StepReviewResponse } from './steps/StepReviewResponse'
import { StepIdealGuest } from './steps/StepIdealGuest'
import { StepCommunicationTone } from './steps/StepCommunicationTone'
import { StepBrandNotes } from './steps/StepBrandNotes'
import { SuccessScreen } from './SuccessScreen'

export type VoiceCaptureData = {
  hostingStyleWords: string
  pastReviewResponse: string
  idealGuest: string
  communicationTone: 'warm' | 'professional' | 'playful' | 'luxurious' | ''
  brandNotes: string
}

const EMPTY_DATA: VoiceCaptureData = {
  hostingStyleWords: '',
  pastReviewResponse: '',
  idealGuest: '',
  communicationTone: '',
  brandNotes: '',
}

const STEPS = [
  { id: 1, label: 'Hosting Style', shortLabel: 'Style' },
  { id: 2, label: 'Your Writing', shortLabel: 'Writing' },
  { id: 3, label: 'Ideal Guest', shortLabel: 'Guest' },
  { id: 4, label: 'Tone', shortLabel: 'Tone' },
  { id: 5, label: 'Brand Notes', shortLabel: 'Brand' },
]

type Props = {
  /** When true, renders as a settings panel (no full-page wrapper styling) */
  isSettingsMode?: boolean
  /** Optional callback for settings mode — called on success instead of redirect */
  onSuccess?: () => void
}

export function VoiceCaptureWizard({ isSettingsMode = false, onSuccess }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<VoiceCaptureData>(EMPTY_DATA)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const updateField = useCallback(
    <K extends keyof VoiceCaptureData>(field: K, value: VoiceCaptureData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length))
  }, [])

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
    setSubmitError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/owner-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostingStyleWords: formData.hostingStyleWords,
          pastReviewResponse: formData.pastReviewResponse,
          idealGuest: formData.idealGuest,
          communicationTone: formData.communicationTone,
          brandNotes: formData.brandNotes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
        return
      }

      // Success
      setIsComplete(true)

      if (isSettingsMode && onSuccess) {
        onSuccess()
      } else {
        // Redirect to dashboard handled by SuccessScreen component
      }
    } catch {
      setSubmitError(
        'Network error — your answers are still saved here. Please check your connection and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, isSettingsMode, onSuccess])

  const handleDashboardRedirect = useCallback(() => {
    router.push('/dashboard?voice_setup=complete')
  }, [router])

  if (isComplete) {
    return (
      <SuccessScreen
        isSettingsMode={isSettingsMode}
        onContinue={handleDashboardRedirect}
      />
    )
  }

  const containerClass = isSettingsMode
    ? 'w-full'
    : 'flex items-center justify-center min-h-screen px-4 py-12'

  const cardClass = isSettingsMode
    ? 'w-full'
    : 'w-full max-w-2xl mx-auto'

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* Card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          {!isSettingsMode && (
            <div className="px-8 pt-8 pb-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 mb-4">
                <span className="text-2xl">🎙️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                Teach your AI your voice
              </h1>
              <p className="mt-2 text-slate-400 text-sm max-w-md mx-auto">
                5 quick questions so every review response, caption, and listing copy
                sounds exactly like you — not generic AI.
              </p>
            </div>
          )}

          {isSettingsMode && (
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-bold text-white">Update your brand voice</h2>
              <p className="mt-1 text-slate-400 text-sm">
                Refresh your answers anytime to keep AI-generated content sounding like you.
              </p>
            </div>
          )}

          {/* Progress */}
          <VoiceProgress steps={STEPS} currentStep={currentStep} />

          {/* Step content */}
          <div className="px-6 md:px-8 py-6">
            {currentStep === 1 && (
              <StepHostingStyle
                value={formData.hostingStyleWords}
                onChange={(v) => updateField('hostingStyleWords', v)}
                onNext={handleNext}
              />
            )}
            {currentStep === 2 && (
              <StepReviewResponse
                value={formData.pastReviewResponse}
                onChange={(v) => updateField('pastReviewResponse', v)}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 3 && (
              <StepIdealGuest
                value={formData.idealGuest}
                onChange={(v) => updateField('idealGuest', v)}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 4 && (
              <StepCommunicationTone
                value={formData.communicationTone}
                onChange={(v) =>
                  updateField(
                    'communicationTone',
                    v as VoiceCaptureData['communicationTone']
                  )
                }
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 5 && (
              <StepBrandNotes
                value={formData.brandNotes}
                onChange={(v) => updateField('brandNotes', v)}
                onSubmit={handleSubmit}
                onBack={handleBack}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onClearError={() => setSubmitError(null)}
              />
            )}
          </div>
        </div>

        {/* Footer note */}
        {!isSettingsMode && (
          <p className="text-center text-slate-500 text-xs mt-4">
            You can update your brand voice anytime from dashboard settings.
          </p>
        )}
      </div>
    </div>
  )
}
