'use client'

import type { CategoryScore } from '@/types/audit'

type Props = {
  category: CategoryScore
}

const CATEGORY_ICONS: Record<string, string> = {
  title: '✏️',
  description: '📝',
  photos: '📸',
  amenities: '🛋️',
  pricing: '💰',
  reviews: '⭐',
  seo: '🔍',
  response_rate: '💬',
  availability: '📅',
  location: '📍',
  default: '📊',
}

export function CategoryCard({ category }: Props) {
  const pct = Math.round((category.score / category.max_score) * 100)
  const color = getBarColor(pct)
  const icon = CATEGORY_ICONS[category.category] ?? CATEGORY_ICONS.default

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{category.label}</h3>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-lg font-bold tabular-nums" style={{ color }}>
            {category.score}
          </span>
          <span className="text-slate-600 text-sm">/{category.max_score}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>

      {/* Summary */}
      {category.summary && (
        <p className="text-slate-400 text-xs leading-relaxed">{category.summary}</p>
      )}

      {/* Quick problem count */}
      {category.problems && category.problems.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          <span className="text-xs text-slate-500">
            {category.problems.length} issue{category.problems.length !== 1 ? 's' : ''} detected
          </span>
        </div>
      )}
    </div>
  )
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#34d399'
  if (pct >= 60) return '#fbbf24'
  if (pct >= 40) return '#f97316'
  return '#f87171'
}
