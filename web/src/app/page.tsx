'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function isValidAirbnbUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname === 'www.airbnb.com' || parsed.hostname === 'airbnb.com') &&
      (parsed.pathname.includes('/rooms/') || parsed.pathname.includes('/h/'))
    )
  } catch {
    return false
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LandingPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [urlError, setUrlError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = (): boolean => {
    let valid = true

    if (!url.trim()) {
      setUrlError('Please enter your Airbnb listing URL')
      valid = false
    } else if (!isValidAirbnbUrl(url.trim())) {
      setUrlError('Please enter a valid Airbnb listing URL (e.g. airbnb.com/rooms/12345)')
      valid = false
    } else {
      setUrlError('')
    }

    if (!email.trim()) {
      setEmailError('Please enter your email address')
      valid = false
    } else if (!isValidEmail(email.trim())) {
      setEmailError('Please enter a valid email address')
      valid = false
    } else {
      setEmailError('')
    }

    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setServerError(data.error || 'Something went wrong. Please try again.')
        return
      }

      router.push(`/audit/${data.auditId}/pending`)
    } catch {
      setServerError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">VAEL Host</span>
          <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-400/30">
            Beta
          </span>
        </div>
        <a
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign in →
        </a>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 pt-16 pb-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm px-4 py-1.5 rounded-full mb-8 font-medium">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Free listing audit — no account required
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
          Your Airbnb listing
          <br />
          <span className="text-amber-400">could be earning more.</span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
          Paste your listing URL and get a free AI-powered audit in 2 minutes.
          See exactly what&apos;s hurting your ranking — and what to fix first.
        </p>

        {/* Value Props */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-14 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-base">✓</span>
            <span>Listing score out of 100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-base">✓</span>
            <span>Exact gaps + how to fix them</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-base">✓</span>
            <span>Free — no credit card needed</span>
          </div>
        </div>

        {/* CTA Form */}
        <div className="max-w-xl mx-auto bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* URL Input */}
            <div className="text-left">
              <label htmlFor="listing-url" className="block text-sm font-medium text-slate-300 mb-1.5">
                Airbnb listing URL
              </label>
              <input
                id="listing-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlError) setUrlError('')
                  if (serverError) setServerError('')
                }}
                placeholder="https://airbnb.com/rooms/12345678"
                className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm transition-colors ${
                  urlError ? 'border-red-500' : 'border-slate-600'
                }`}
                disabled={isSubmitting}
                autoComplete="url"
              />
              {urlError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <span>⚠</span> {urlError}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="text-left">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                  if (serverError) setServerError('')
                }}
                placeholder="you@example.com"
                className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm transition-colors ${
                  emailError ? 'border-red-500' : 'border-slate-600'
                }`}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {emailError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <span>⚠</span> {emailError}
                </p>
              )}
            </div>

            {/* Server Error */}
            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting your audit…
                </>
              ) : (
                <>
                  Get my free audit
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center pt-1">
              We&apos;ll email your results. No spam, ever.
            </p>
          </form>
        </div>

        {/* Social Proof */}
        <div className="mt-16">
          <p className="text-xs text-slate-600 uppercase tracking-widest mb-6 font-medium">
            What hosts are saying
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 text-left"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <span key={s} className="text-amber-400 text-xs">★</span>
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24 max-w-3xl mx-auto">
          <p className="text-xs text-slate-600 uppercase tracking-widest mb-10 font-medium">
            How it works
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl mx-auto mb-4">
                  {step.icon}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center">
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} VAEL Host · Built for short-term rental owners
        </p>
      </footer>
    </div>
  )
}

const TESTIMONIALS = [
  {
    quote: 'My listing score was 38/100. Three weeks after fixing what VAEL flagged, I jumped to page 2 in my market.',
    name: 'Sarah M.',
    initials: 'SM',
    location: 'Scottsdale, AZ',
  },
  {
    quote: 'The audit showed me my photos were the #1 problem. I never would have guessed. Bookings are up 40%.',
    name: 'James R.',
    initials: 'JR',
    location: 'Nashville, TN',
  },
  {
    quote: 'Free, fast, and brutally honest. I spent 30 minutes fixing the copy and immediately saw a difference.',
    name: 'Priya K.',
    initials: 'PK',
    location: 'Austin, TX',
  },
]

const HOW_IT_WORKS = [
  {
    icon: '🔗',
    title: 'Paste your Airbnb URL',
    description: 'Drop your listing link. No account needed — just a URL and your email.',
  },
  {
    icon: '🤖',
    title: 'AI analyzes everything',
    description: 'We score your title, photos, description, pricing, and positioning against your market.',
  },
  {
    icon: '📬',
    title: 'Get your report',
    description: 'A scored report card lands in your inbox in ~2 minutes. See exactly what to fix first.',
  },
]
