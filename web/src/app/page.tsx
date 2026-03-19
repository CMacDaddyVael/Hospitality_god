'use client'

import { useState } from 'react'
import EmailCaptureModal from '@/components/EmailCaptureModal'

function isValidAirbnbUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return (
      (u.hostname === 'airbnb.com' || u.hostname === 'www.airbnb.com') &&
      (u.pathname.startsWith('/rooms/') || u.pathname.startsWith('/h/'))
    )
  } catch {
    return false
  }
}

export default function LandingPage() {
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setUrlError('')

    if (!url.trim()) {
      setUrlError('Please enter your Airbnb listing URL.')
      return
    }

    if (!isValidAirbnbUrl(url)) {
      setUrlError(
        'Please enter a valid Airbnb listing URL (e.g. https://airbnb.com/rooms/12345).'
      )
      return
    }

    setShowModal(true)
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 text-amber-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Free Listing Audit — No Credit Card Required
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight">
            Your Airbnb listing is{' '}
            <span className="text-amber-400">losing bookings</span>.
            <br />
            Find out why.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
            Paste your listing URL and get a free AI audit in under 60 seconds — scored
            out of 100, with exactly what to fix.
          </p>
        </div>

        {/* URL Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setUrlError('')
                }}
                placeholder="https://airbnb.com/rooms/12345678"
                aria-label="Airbnb listing URL"
                aria-describedby={urlError ? 'url-error' : undefined}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-base transition-colors ${
                  urlError
                    ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                    : 'border-slate-700'
                }`}
              />
            </div>
            <button
              type="submit"
              className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-xl text-base transition-colors whitespace-nowrap shadow-lg shadow-amber-400/20 hover:shadow-amber-300/30"
            >
              Get Free Audit →
            </button>
          </div>

          {urlError && (
            <p id="url-error" className="text-red-400 text-sm text-left px-1">
              {urlError}
            </p>
          )}
        </form>

        {/* Social proof */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Free forever
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Results in under 60 seconds
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            No account required
          </span>
        </div>

        {/* Sample score teaser */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-left space-y-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">
            Example audit result
          </p>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeDasharray="175.9"
                  strokeDashoffset="105"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
                41
              </span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Listing Score: 41/100</p>
              <p className="text-slate-400 text-sm">
                Poor title clarity · Missing amenity keywords · Only 9 photos (need 20+) ·
                No seasonal copy
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Title', score: 30, color: 'bg-red-500' },
              { label: 'Photos', score: 45, color: 'bg-orange-500' },
              { label: 'Description', score: 38, color: 'bg-red-500' },
              { label: 'Amenities', score: 60, color: 'bg-yellow-500' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{item.label}</span>
                  <span>{item.score}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email capture modal */}
      {showModal && (
        <EmailCaptureModal
          listingUrl={url}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  )
}
