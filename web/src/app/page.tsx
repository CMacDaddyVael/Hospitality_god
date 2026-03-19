'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateUrl = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return 'Please enter your Airbnb listing URL'
    if (
      !trimmed.includes('airbnb.com/rooms/') &&
      !trimmed.includes('airbnb.com/h/')
    ) {
      return 'Please enter a valid Airbnb listing URL (e.g. airbnb.com/rooms/12345)'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateUrl(url)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setIsLoading(true)
    // Store URL in sessionStorage and redirect to audit flow
    sessionStorage.setItem('audit_url', url.trim())
    router.push('/audit?step=email')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="w-full max-w-2xl text-center space-y-6">
        {/* Logo / wordmark */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-3xl">🏨</span>
          <span className="text-2xl font-bold text-white tracking-tight">
            Hospitality<span className="text-amber-400">God</span>
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
          Is your Airbnb listing{' '}
          <span className="text-amber-400">leaving money on the table?</span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto">
          Paste your listing URL and get a free, instant score with exactly
          what to fix — no sign-up required to start.
        </p>

        {/* URL Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4 text-left"
        >
          <label className="block text-sm font-medium text-slate-300">
            Your Airbnb listing URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (error) setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
              placeholder="https://airbnb.com/rooms/12345678"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold rounded-xl transition-all duration-200 text-sm whitespace-nowrap"
            >
              {isLoading ? 'Loading…' : 'Get Free Audit →'}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          )}

          <p className="text-xs text-slate-500">
            Works with any public Airbnb listing. Free, instant, no credit card.
          </p>
        </form>

        {/* Social proof */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-slate-500 text-sm pt-2">
          <span>✓ 0–100 listing score</span>
          <span>✓ Per-category breakdown</span>
          <span>✓ Actionable fix list</span>
          <span>✓ Under 30 seconds</span>
        </div>
      </div>

      {/* Sample score preview */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-4">
          Example report card
        </p>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Title', score: 55, color: 'text-yellow-400' },
            { label: 'Photos', score: 40, color: 'text-red-400' },
            { label: 'Description', score: 70, color: 'text-green-400' },
            { label: 'Amenities', score: 60, color: 'text-yellow-400' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`text-3xl font-bold ${item.color}`}>
                {item.score}
              </div>
              <div className="text-slate-400 text-xs mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-600 text-xs mt-3">
          Overall score: 56/100 — 3 critical issues found
        </p>
      </div>
    </main>
  )
}
