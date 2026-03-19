'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

function validateAirbnbUrl(url: string): string | null {
  if (!url.trim()) return 'Please enter your Airbnb listing URL'
  
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return 'Please enter a valid URL (e.g. https://airbnb.com/rooms/12345)'
  }

  const host = parsed.hostname.replace('www.', '')
  if (host !== 'airbnb.com') {
    return 'Please enter an Airbnb listing URL (airbnb.com/rooms/…)'
  }

  if (!parsed.pathname.startsWith('/rooms/')) {
    return 'URL must point to a specific listing (airbnb.com/rooms/…)'
  }

  const roomId = parsed.pathname.split('/rooms/')[1]?.split('/')[0]
  if (!roomId || !/^\d+$/.test(roomId)) {
    return 'Could not find a listing ID in that URL — try copying it directly from Airbnb'
  }

  return null
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address'
  return null
}

export default function HomePage() {
  const router = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null)

  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [showEmailCapture, setShowEmailCapture] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateAirbnbUrl(url)
    if (err) {
      setUrlError(err)
      return
    }
    setUrlError('')
    setShowEmailCapture(true)
    setTimeout(() => emailInputRef.current?.focus(), 100)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) {
      setEmailError(err)
      return
    }
    setEmailError('')
    setSubmitError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: email.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Something went wrong. Please try again.')
        setIsSubmitting(false)
        return
      }

      router.push(`/audit/${data.auditId}?processing=true`)
    } catch {
      setSubmitError('Network error — please check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  function handleUrlChange(val: string) {
    setUrl(val)
    if (urlError) setUrlError('')
    if (showEmailCapture) {
      setShowEmailCapture(false)
      setEmail('')
      setEmailError('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="w-full px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xl font-bold tracking-tight">
            ✦ Hospitality God
          </span>
        </div>
        <div className="text-slate-400 text-sm hidden sm:block">
          AI marketing for short-term rental owners
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="w-full max-w-2xl mx-auto text-center space-y-6">
          {/* Score Hook Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-2 text-amber-400 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            Most listings score below 50 — find out where yours stands
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            Your Airbnb listing is{' '}
            <span className="text-amber-400">losing bookings</span>{' '}
            right now
          </h1>

          {/* Sub-headline */}
          <p className="text-slate-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
            Get a free AI audit in 60 seconds. See exactly what's costing you
            rankings, clicks, and revenue — with a fix for every issue.
          </p>

          {/* Social Proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">★★★★★</span>
              <span>Loved by 200+ hosts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span>
              <span>Free — no credit card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400">⚡</span>
              <span>Results in under 60 seconds</span>
            </div>
          </div>

          {/* URL Form */}
          <form onSubmit={handleUrlSubmit} className="pt-4 space-y-3" noValidate>
            <div className="relative">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://airbnb.com/rooms/12345678"
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all text-sm sm:text-base ${
                      urlError
                        ? 'border-red-500 focus:ring-red-500/30'
                        : 'border-slate-700 focus:ring-amber-400/30 focus:border-amber-400'
                    }`}
                    autoComplete="url"
                    spellCheck={false}
                  />
                </div>
                <button
                  type="submit"
                  disabled={showEmailCapture && !url.trim()}
                  className="sm:whitespace-nowrap px-6 py-4 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl transition-colors text-sm sm:text-base"
                >
                  Get My Free Audit
                </button>
              </div>
              {urlError && (
                <p className="absolute -bottom-6 left-0 text-red-400 text-sm flex items-center gap-1 mt-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {urlError}
                </p>
              )}
            </div>
          </form>

          {/* Email Capture — appears inline after URL validated */}
          {showEmailCapture && (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
              <form
                onSubmit={handleEmailSubmit}
                className="bg-slate-900 border border-amber-400/30 rounded-2xl p-6 space-y-4 text-left mt-8"
                noValidate
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-amber-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400">
                      Listing URL confirmed —{' '}
                      <span className="text-white font-medium truncate max-w-xs inline-block align-bottom">
                        {url.length > 50 ? url.slice(0, 50) + '…' : url}
                      </span>
                    </p>
                  </div>
                  <h3 className="text-lg font-semibold text-white pt-2">
                    Where should we send your results?
                  </h3>
                  <p className="text-slate-400 text-sm">
                    We'll email you a link to your full audit report — and alert you if your score changes.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (emailError) setEmailError('')
                          if (submitError) setSubmitError('')
                        }}
                        placeholder="you@example.com"
                        className={`w-full bg-slate-800 border rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all text-sm ${
                          emailError
                            ? 'border-red-500 focus:ring-red-500/30'
                            : 'border-slate-700 focus:ring-amber-400/30 focus:border-amber-400'
                        }`}
                        autoComplete="email"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="sm:whitespace-nowrap px-6 py-3.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-70 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 min-w-[160px]"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Starting Audit…
                        </>
                      ) : (
                        'Run My Audit →'
                      )}
                    </button>
                  </div>
                  {emailError && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {emailError}
                    </p>
                  )}
                  {submitError && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {submitError}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-600">
                  No spam, ever. We'll only email you about your audit and listing score updates.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-800 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-white mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: '🔗',
                title: 'Paste your listing URL',
                body: 'Drop in your Airbnb URL. No login, no account, no credit card.',
              },
              {
                step: '02',
                icon: '🤖',
                title: 'AI analyzes everything',
                body: 'We score your title, photos, description, pricing strategy, reviews, and 20+ other factors.',
              },
              {
                step: '03',
                icon: '📊',
                title: 'Get your score + fixes',
                body: "See exactly where you're losing bookings — with a prioritized list of fixes ranked by impact.",
              },
            ].map(({ step, icon, title, body }) => (
              <div key={step} className="relative space-y-3 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-2xl">
                  {icon}
                </div>
                <div className="text-xs font-mono text-amber-400/60 tracking-widest">{step}</div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8 text-center text-slate-600 text-sm">
        © {new Date().getFullYear()} Hospitality God · AI marketing for short-term rental owners
      </footer>
    </main>
  )
}
