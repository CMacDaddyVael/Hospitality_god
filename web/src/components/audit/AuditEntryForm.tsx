'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Accepts:
 *  - airbnb.com/rooms/12345678…
 *  - airbnb.com/h/…         (short URL format)
 *  - vrbo.com/…             (any VRBO path containing a numeric or slug listing id)
 *  - homeaway.com/…         (HomeAway rebranded to Vrbo)
 *
 * We require the URL to start with http/https and contain one of the known
 * host+path patterns.
 */
const AIRBNB_REGEX =
  /^https?:\/\/(www\.)?airbnb\.(com|co\.[a-z]{2}|[a-z]{2})\/(rooms\/\d+|h\/[a-zA-Z0-9_-]+)/i

const VRBO_REGEX =
  /^https?:\/\/(www\.)?(vrbo\.com|homeaway\.com)\/.+/i

function isValidListingUrl(url: string): boolean {
  const trimmed = url.trim()
  return AIRBNB_REGEX.test(trimmed) || VRBO_REGEX.test(trimmed)
}

function detectPlatform(url: string): 'airbnb' | 'vrbo' | null {
  if (AIRBNB_REGEX.test(url.trim())) return 'airbnb'
  if (VRBO_REGEX.test(url.trim())) return 'vrbo'
  return null
}

// ---------------------------------------------------------------------------
// Progress messages — shown while the audit runs
// ---------------------------------------------------------------------------

const PROGRESS_STEPS = [
  { pct: 8,  label: 'Fetching your listing…' },
  { pct: 22, label: 'Reading photos and amenities…' },
  { pct: 40, label: 'Analyzing your title and description…' },
  { pct: 57, label: 'Reviewing guest reviews…' },
  { pct: 72, label: 'Benchmarking against comparable listings…' },
  { pct: 85, label: 'Calculating your listing score…' },
  { pct: 95, label: 'Preparing your report…' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type FormState = 'idle' | 'loading' | 'error'

export function AuditEntryForm() {
  const router = useRouter()

  const [url, setUrl] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [validationError, setValidationError] = useState('')
  const [serverError, setServerError] = useState('')

  // Progress animation
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState(PROGRESS_STEPS[0].label)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressStepRef = useRef(0)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Progress ticker
  // ---------------------------------------------------------------------------

  function startProgressTicker() {
    progressStepRef.current = 0
    setProgressPct(PROGRESS_STEPS[0].pct)
    setProgressLabel(PROGRESS_STEPS[0].label)

    progressIntervalRef.current = setInterval(() => {
      const next = progressStepRef.current + 1
      if (next < PROGRESS_STEPS.length) {
        progressStepRef.current = next
        setProgressPct(PROGRESS_STEPS[next].pct)
        setProgressLabel(PROGRESS_STEPS[next].label)
      }
    }, 2200)
  }

  function stopProgressTicker() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value)
    if (validationError) setValidationError('')
    if (serverError) setServerError('')
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()

    const trimmedUrl = url.trim()

    // Client-side validation
    if (!trimmedUrl) {
      setValidationError('Please paste your Airbnb or Vrbo listing URL.')
      inputRef.current?.focus()
      return
    }

    if (!isValidListingUrl(trimmedUrl)) {
      setValidationError(
        'That doesn\'t look like a valid Airbnb or Vrbo listing URL. ' +
        'It should look like: airbnb.com/rooms/12345678 or vrbo.com/1234567'
      )
      inputRef.current?.focus()
      return
    }

    // Start loading state
    setFormState('loading')
    setServerError('')
    setValidationError('')
    startProgressTicker()

    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`)
      }

      if (!data.auditId) {
        throw new Error('Invalid response from server — missing audit ID.')
      }

      // Complete the progress bar before navigating
      stopProgressTicker()
      setProgressPct(100)
      setProgressLabel('Done! Loading your results…')

      // Small pause so the user sees 100%
      await new Promise((resolve) => setTimeout(resolve, 600))

      router.push(`/audit/${data.auditId}`)
    } catch (err: unknown) {
      stopProgressTicker()
      setFormState('error')
      setProgressPct(0)

      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'

      setServerError(message)
    }
  }

  function handleRetry() {
    setFormState('idle')
    setServerError('')
    setProgressPct(0)
    setProgressLabel(PROGRESS_STEPS[0].label)
    inputRef.current?.focus()
  }

  // ---------------------------------------------------------------------------
  // Derived UI state
  // ---------------------------------------------------------------------------

  const isLoading = formState === 'loading'
  const platform = detectPlatform(url)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* ── IDLE / ERROR STATE ── */}
      {!isLoading && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl shadow-black/20 backdrop-blur-sm">
            {/* Input row */}
            <div className="space-y-2">
              <label
                htmlFor="listing-url"
                className="block text-sm font-medium text-slate-300"
              >
                Your listing URL
              </label>

              <div className="relative">
                {/* Platform badge inside input */}
                {platform && (
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        platform === 'airbnb'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {platform === 'airbnb' ? 'Airbnb' : 'Vrbo'}
                    </span>
                  </div>
                )}

                <input
                  ref={inputRef}
                  id="listing-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={url}
                  onChange={handleUrlChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                  }}
                  placeholder="https://airbnb.com/rooms/12345678"
                  disabled={isLoading}
                  aria-describedby={validationError ? 'url-error' : undefined}
                  aria-invalid={!!validationError}
                  className={[
                    'w-full bg-slate-800 border rounded-xl py-3.5 pr-4 text-white',
                    'placeholder-slate-500 text-sm sm:text-base',
                    'focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400',
                    'transition-colors duration-150',
                    'disabled:opacity-50',
                    platform ? 'pl-20' : 'pl-4',
                    validationError
                      ? 'border-red-500/70 focus:ring-red-500/30 focus:border-red-500'
                      : 'border-slate-600/60',
                  ].join(' ')}
                />
              </div>

              {/* Validation error */}
              {validationError && (
                <p
                  id="url-error"
                  role="alert"
                  className="flex items-start gap-1.5 text-red-400 text-sm mt-1.5"
                >
                  <svg
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  {validationError}
                </p>
              )}
            </div>

            {/* Server / network error */}
            {serverError && formState === 'error' && (
              <div
                role="alert"
                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    We couldn't analyze that listing right now.
                  </p>
                  <p className="text-xs text-red-400/80">{serverError}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="text-xs font-semibold underline underline-offset-2 hover:text-red-300 transition-colors"
                  >
                    Try again →
                  </button>
                </div>
              </div>
            )}

            {/* CTA button */}
            <button
              type="submit"
              disabled={isLoading}
              className={[
                'w-full py-4 px-6 rounded-xl font-semibold text-base sm:text-lg',
                'bg-amber-400 hover:bg-amber-300 active:bg-amber-500',
                'text-slate-900',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-slate-900',
                'shadow-lg shadow-amber-400/10',
              ].join(' ')}
            >
              Audit My Listing — Free
            </button>

            <p className="text-center text-slate-500 text-xs">
              Works with Airbnb &amp; Vrbo · No login required · Results in ~60 seconds
            </p>
          </div>
        </form>
      )}

      {/* ── LOADING STATE ── */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Audit in progress"
          className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-8 sm:p-10 space-y-8 shadow-xl shadow-black/20 backdrop-blur-sm text-center"
        >
          {/* Animated icon */}
          <div className="flex justify-center">
            <div className="relative w-16 h-16">
              {/* Outer pulse ring */}
              <span className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
              {/* Icon container */}
              <div className="relative w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-amber-400 animate-spin"
                  style={{ animationDuration: '1.4s' }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Progress label */}
          <div className="space-y-1">
            <p className="text-white font-semibold text-lg">{progressLabel}</p>
            <p className="text-slate-500 text-sm">
              Your free audit is running — this takes about a minute
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-[1800ms] ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-right text-slate-500 text-xs tabular-nums">
              {progressPct}%
            </p>
          </div>

          {/* The URL being analyzed */}
          <p className="text-slate-600 text-xs truncate px-4">
            Analyzing:{' '}
            <span className="text-slate-400 font-mono">{url}</span>
          </p>
        </div>
      )}
    </div>
  )
}
