'use client'

import { useEffect, useRef } from 'react'
import WaitlistForm from './WaitlistForm'

export default function Hero() {
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Animate in on mount
    if (badgeRef.current) {
      badgeRef.current.style.opacity = '1'
      badgeRef.current.style.transform = 'translateY(0)'
    }
  }, [])

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden grid-bg"
      aria-labelledby="hero-headline"
    >
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-800/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Badge */}
        <div
          ref={badgeRef}
          className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 mb-8 text-sm text-brand-300 font-medium"
          style={{
            opacity: 0,
            transform: 'translateY(-10px)',
            transition: 'all 0.6s ease-out',
          }}
          role="status"
          aria-label="Beta launching April 2026"
        >
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" aria-hidden="true" />
          Beta launching April 2026 · Spots are limited
        </div>

        {/* Headline */}
        <h1
          id="hero-headline"
          className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-6"
        >
          Your AI marketing team
          <br />
          for your{' '}
          <span className="gradient-text">Airbnb</span>
          <br />
          <span className="text-gray-300 font-bold">
            does the work, not just the advice
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Hospitality God is an autonomous AI CMO that optimizes your listings,
          responds to reviews, and handles guest communication —{' '}
          <strong className="text-gray-200">automatically</strong>. For
          $99-199/mo, you get the marketing muscle of a $3K/mo agency.
        </p>

        {/* Hero CTA form */}
        <div className="max-w-xl mx-auto mb-12">
          <WaitlistForm variant="hero" />
        </div>

        {/* Social proof micro-stats */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-gray-500"
          aria-label="Trust indicators"
        >
          <div className="flex items-center gap-2">
            <span className="text-green-400" aria-hidden="true">✓</span>
            <span>No agency fees</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400" aria-hidden="true">✓</span>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400" aria-hidden="true">✓</span>
            <span>Works with Airbnb & Vrbo</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600 text-xs"
        aria-hidden="true"
      >
        <span>Scroll to learn more</span>
        <svg
          className="w-4 h-4 animate-bounce"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </section>
  )
}
