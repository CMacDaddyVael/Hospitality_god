'use client'

import { useState } from 'react'
import type { Deliverable, DeliverableType } from './DeliverablesPanel'

type TypeConfig = {
  label: string
  icon: string
  color: string
}

type Props = {
  items: Deliverable[]
  typeConfig: Record<DeliverableType, TypeConfig>
}

export function CompletedDeliverables({ items, typeConfig }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <section className="border-t border-slate-700/40 pt-6">
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-3 w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-slate-400 group-hover:text-slate-300 font-semibold text-sm transition-colors">
            Completed
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/30">
            {items.length}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {items.map((item) => {
            const config = typeConfig[item.type]
            const dateStr = item.used_at
              ? new Date(item.used_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })

            return (
              <div
                key={item.id}
                className="bg-slate-800/20 border border-slate-700/30 rounded-xl px-5 py-4 flex items-start gap-4 opacity-60"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <span className="text-base">{config.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.color}`}
                    >
                      {config.label}
                    </span>
                    {item.status === 'edited_approved' && (
                      <span className="text-xs text-slate-500 italic">edited</span>
                    )}
                    <span className="text-xs text-slate-600 ml-auto flex-shrink-0">
                      Used {dateStr}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                    {item.content}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
