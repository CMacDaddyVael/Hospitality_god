'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingUrl: string
  onClose: () => void
}

export default function EmailCaptureModal({ listingUrl, onClose }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus email input when modal opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const validateEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    if (!email.trim()) {
      setEmailError('Please enter your email address.')
      return
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl.trim(), email: email.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEmailError(data.error || 'Something went wrong. Please try again.')
        setIsSubmitting(false)
        return
      }

      // Redirect to results page
      router.push(`/results/${data.auditId}`)
    } catch {
      setEmailError('Network error. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-6 mx-auto">
          <span className="text-2xl">📬</span>
        </div>

        {/* Copy */}
        <div className="text-center space-y-2 mb-6">
          <h2 id="modal-title" className="text-xl font-bold text-white">
            Where should we send your report?
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your free audit is ready to run. Enter your email and we'll send you
            the full report with your score and exact fixes.
          </p>
        </div>

        {/* URL preview */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <span className="text-lg">🏡</span>
          <span className="text-slate-400 text-sm truncate flex-1">{listingUrl}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Your email
            </label>
            <input
              id="email"
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError('')
              }}
              placeholder="you@example.com"
              aria-describedby={emailError ? 'email-error' : undefined}
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-base transition-colors ${
                emailError
                  ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                  : 'border-slate-600'
              }`}
            />
            {emailError && (
              <p id="email-error" className="mt-1.5 text-red-400 text-sm">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-900 disabled:text-slate-500 font-bold rounded-xl text-base transition-colors shadow-lg shadow-amber-400/20"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting audit…
              </span>
            ) : (
              'Run My Free Audit →'
            )}
          </button>

          <p className="text-center text-slate-500 text-xs">
            No spam. One report email, then only updates you ask for.
          </p>
        </form>
      </div>
    </div>
  )
}
