'use client'

import { useEffect, useState } from 'react'
import type { AuditData } from '@/lib/audit/getAudit'

type Props = {
  audit: AuditData
}

const LOADING_STEPS = [
  { label: 'Fetching your listing details...', duration: 5 },
  { label: 'Analyzing photos and visual quality...', duration: 8 },
  { label: 'Reading your title and description...', duration: 6 },
  { label: 'Scanning reviews and reputation signals...', duration: 7 },
  { label: 'Checking amenities and features...', duration: 5 },
  { label: 'Scoring against top-ranked listings...', duration: 8 },
  { label: 'Generating your report card...', duration: 6 },
]

export function LoadingState({ audit }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const estimatedWait = audit.estimated_wait_seconds ?? 45

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Advance through loading steps based on elapsed time
    const totalDuration = LOADING_STEPS.reduce((a, s) => a + s.duration, 0)
    let cumulative = 0
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      cumulative += LOADING_STEPS[i].duration
      const stepProgress = Math.min(elapsedSeconds / estimatedWait, 0.95) * totalDuration
      if (stepProgress < cumulative) {
        setStepIndex(i)
        break
      }
    }
  }, [elapsedSeconds, estimatedWait])

  const progressPct = Math.min((elapsedSeconds / estimatedWait) * 100, 95)
  const remaining = Math.max(0, estimatedWait - elapsedSeconds)

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-2">
            <span className="text-3xl animate-pulse">⚡</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Analyzing your listing
          </h1>
          <p className="text-slate-400 text-sm">
            Our AI is scoring your property against thousands of top-ranked listings.
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{Math.round(progressPct)}% complete</span>
            {remaining > 0 && <span>~{remaining}s remaining</span>}
          </div>
        </div>

        {/* Current step */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
            <p className="text-slate-300 text-sm font-medium">
              {LOADING_STEPS[stepIndex]?.label ?? 'Finalizing your report...'}
            </p>
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-2">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                i < stepIndex ? 'text-slate-500' : i === stepIndex ? 'text-white' : 'text-slate-700'
              }`}
            >
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {i < stepIndex ? (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : i === stepIndex ? (
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                ) : (
                  <span className="w-2 h-2 bg-slate-700 rounded-full" />
                )}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600">
          This page will automatically update when your report is ready.
        </p>
      </div>
    </div>
  )
}
