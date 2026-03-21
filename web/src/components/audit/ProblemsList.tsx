'use client'

import type { AuditProblem } from '@/types/audit'

type Props = {
  problems: AuditProblem[]
}

const SEVERITY_CONFIG = {
  high: {
    label: 'High Impact',
    dot: 'bg-red-400',
    badge: 'bg-red-950 text-red-400 border-red-900',
    border: 'border-red-900/40',
    icon: '🔴',
  },
  medium: {
    label: 'Medium Impact',
    dot: 'bg-amber-400',
    badge: 'bg-amber-950 text-amber-400 border-amber-900',
    border: 'border-amber-900/40',
    icon: '🟡',
  },
  low: {
    label: 'Low Impact',
    dot: 'bg-blue-400',
    badge: 'bg-blue-950 text-blue-400 border-blue-900',
    border: 'border-blue-900/40',
    icon: '🔵',
  },
}

export function ProblemsList({ problems }: Props) {
  // Sort: high → medium → low
  const sorted = [...problems].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="space-y-3">
      {sorted.map((problem, idx) => {
        const config = SEVERITY_CONFIG[problem.severity]
        return (
          <div
            key={problem.id || idx}
            className={`bg-slate-900 border rounded-2xl p-5 ${config.border} hover:border-slate-700 transition-colors`}
          >
            <div className="flex items-start gap-4">
              {/* Number badge */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 mt-0.5">
                {idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold text-white text-sm leading-snug">
                    {problem.title}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border flex-shrink-0 ${config.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{problem.description}</p>
                {problem.category && (
                  <span className="inline-block text-xs text-slate-600 uppercase tracking-wide">
                    {problem.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Teaser — more problems hidden */}
      <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-5 text-center space-y-2">
        <div className="text-2xl">🔒</div>
        <p className="text-slate-400 text-sm font-medium">
          Pro members see all issues + get them fixed automatically
        </p>
        <p className="text-slate-600 text-xs">
          Rewritten titles, optimized descriptions, and seasonal updates — done for you.
        </p>
      </div>
    </div>
  )
}
