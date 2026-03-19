'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-dark-900/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
      role="banner"
    >
      <nav
        className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="Hospitality God — home"
        >
          <span className="text-2xl" aria-hidden="true">
            🏨
          </span>
          <span className="font-bold text-white text-lg tracking-tight">
            Hospitality{' '}
            <span className="gradient-text">God</span>
          </span>
        </Link>

        {/* Nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a
            href="#features"
            className="hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hover:text-white transition-colors"
          >
            Pricing
          </a>
        </div>

        {/* CTA */}
        <a
          href="#waitlist"
          className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/25 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
          aria-label="Join the beta waitlist"
        >
          Join waitlist
        </a>
      </nav>
    </header>
  )
}
