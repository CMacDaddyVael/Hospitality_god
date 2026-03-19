'use client'

import { useState } from 'react'

type Props = {
  url: string
  onSubmit: (email: string) => void
}

export default function EmailGate({ url, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault()
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    setError('')
    setIsSubmitting(true)
    onSubmit(email.trim())
  }

  // Shorten URL for display
  const displayUrl = url.length > 50 ? url.slice(0, 50) + '…' : url

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-8 space-y-6">
        {/* Icon + heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-1">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Where should we send your report?
          </h2>
          <p className="text-slate-400 text-sm">
            Enter your email and we'll run the audit now — results appear
            instantly on the next screen.
          </p>
        </div>

        {/* Listing URL preview */}
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-green-400 text-lg">🏡</span>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Auditing
            </p>
            <p className="text-white text-sm font-mono truncate">{displayUrl}</p>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
            />
            {error && (
              <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="w-full py-3 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold rounded-xl transition-all duration-200 text-sm"
          >
            {isSubmitting ? 'Starting audit…' : 'Run My Free Audit →'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            No spam. We'll only email you your report and occasional tips.
          </p>
        </form>
      </div>
    </div>
  )
}
