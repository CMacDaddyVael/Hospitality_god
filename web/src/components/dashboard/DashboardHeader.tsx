'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  propertyTitle: string
  pendingCount: number
}

export function DashboardHeader({ propertyTitle, pendingCount }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo + property name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-white text-sm hidden sm:block">Hospitality God</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-slate-700" />
          <span className="text-slate-400 text-sm truncate max-w-[180px]">{propertyTitle}</span>
        </div>

        {/* Center: pending badge */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-400 text-xs font-medium">
              {pendingCount} deliverable{pendingCount !== 1 ? 's' : ''} ready
            </span>
          </div>
        )}

        {/* Nav actions */}
        <div className="flex items-center gap-3">
          <a
            href="/api/auth/signout"
            className="text-slate-500 hover:text-white text-sm transition-colors hidden sm:block"
          >
            Sign out
          </a>
          <button
            className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-2">
          <a href="/api/auth/signout" className="block text-slate-400 text-sm py-2 hover:text-white">
            Sign out
          </a>
        </div>
      )}
    </header>
  )
}
