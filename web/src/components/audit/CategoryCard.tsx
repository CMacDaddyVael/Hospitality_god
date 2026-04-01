'use client'

import { useState } from 'react'
import type { CategoryScore } from '@/lib/audit/getAudit'

type Props = {
  category: CategoryScore
}

const CATEGORY_ICONS: Record<string, string> = {
  'Title & Headline': '✍️',
  'Photos & Visual': '📸',
  'Description & Copy': '📝',
  'Amenities & Features': '🏠',
  'Reviews & Reputation': '⭐',
  'Pricing & Value': '💰',
  // fallbacks
  title: '✍️',
  photos: '📸',
  description: '📝',
  amenities: '🏠',
  reviews: '⭐',
  pricing: '💰',
}

function getIcon(name: string): string {
  // Try exact match first
  if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name]
  // Try partial lowercase match
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key.toLowerCase())) return val
  }
  return '📋'
}

function getCategoryColor(passed: boolean, score: number, maxScore: number) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  if (passed || pct >= 70) return 'emerald'
  if (pct >= 40) return 'yellow'
  return 'red'
}

export function CategoryCard({ category }: Props) {
  const [expanded, setExpanded] = useState(true)
  const pct = category.max_score > 0 ? Math.round((category.score / category.max_score) * 100) : 0
  const color = getCategoryColor(category.passed, category.score, category.max_score)

  const colorClasses = {
    emerald: {
      badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      bar: 'bg-emerald-500',
      dot: 'bg-emerald-400',
      passText: 'text-emerald-400',
    },
    yellow: {
      badge: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      bar: 'bg-yellow-500',
      dot: 'bg-yellow-400',
      passText: 'text-yellow-400',
    },
    red: {
      badge: 'bg-red-500/10 border-red-500/20 text-red-400',
      bar: 'bg-red-500',
      dot: 'bg-red-400',
      passText: 'text-red-400',
    },
  }[color]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-xl flex-shrink-0">{getIcon(category.name)}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white text-sm md:text-base truncate">
              {category.name}
            </span>
            <span className={`text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full border ${colorClasses.badge}`}>
              {category.score}/{category.max_score}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colorClasses.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pass/fail indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {category.passed ? (
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Callouts */}
      {expanded && category.callouts && category.callouts.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-800">
          <div className="pt-3 space-y-2">
            {category.callouts.map((callout, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                  category.passed
                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                    : 'bg-red-500/5 border border-red-500/10'
                }`}
              >
                <span className={`mt-0.5 flex-shrink-0 ${category.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {category.passed ? '✓' : '!'}
                </span>
                <span className={category.passed ? 'text-slate-300' : 'text-slate-200'}>
                  {callout}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No callouts state */}
      {expanded && (!category.callouts || category.callouts.length === 0) && (
        <div className="px-4 pb-4 border-t border-slate-800">
          <p className="pt-3 text-slate-500 text-sm italic">No specific issues identified in this category.</p>
        </div>
      )}
    </div>
  )
}
