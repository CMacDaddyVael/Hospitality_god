'use client'

import { useState } from 'react'
import type { DeliverableCategory } from '../SubscriberOnboarding'

type Props = {
  initialCategories: DeliverableCategory[]
  onComplete: (categories: DeliverableCategory[]) => void
  onSkip: () => void
  isSubmitting: boolean
}

type CategoryOption = {
  id: DeliverableCategory
  label: string
  description: string
  icon: string
  frequency: string
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'social_content',
    label: 'Social Content',
    description: 'Instagram & TikTok posts with AI lifestyle images, captions, and hashtags',
    icon: '📸',
    frequency: 'Weekly',
  },
  {
    id: 'listing_optimization',
    label: 'Listing Optimization',
    description: 'Rewritten titles, descriptions, and tags optimized for Airbnb's algorithm',
    icon: '✍️',
    frequency: 'Monthly',
  },
  {
    id: 'review_responses',
    label: 'Review Responses',
    description: 'Draft responses to guest reviews written in your voice, ready to copy-paste',
    icon: '⭐',
    frequency: 'As needed',
  },
  {
    id: 'seasonal_updates',
    label: 'Seasonal Updates',
    description: 'Refreshed copy and AI-generated seasonal photos for each time of year',
    icon: '🍂',
    frequency: 'Quarterly',
  },
]

export function StepDeliverableCategories({
  initialCategories,
  onComplete,
  onSkip,
  isSubmitting,
}: Props) {
  const [selected, setSelected] = useState<Set<DeliverableCategory>>(
    new Set(initialCategories)
  )

  const toggle = (id: DeliverableCategory) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleContinue = () => {
    // If nothing selected, use all as default
    const categories =
      selected.size > 0
        ? Array.from(selected)
        : CATEGORIES.map((c) => c.id)
    onComplete(categories)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">
          What should your AI team work on?
        </h2>
        <p className="text-slate-400 text-sm">
          Select everything you want. You can change this anytime.
        </p>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat.id)
          return (
            <button
              key={cat.id}
              onClick={() => toggle(cat.id)}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-amber-400 bg-amber-400/5'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-slate-900"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-semibold text-sm ${
                        isSelected ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {cat.label}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">
                      {cat.frequency}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selection hint */}
      {selected.size === 0 && (
        <p className="text-xs text-slate-500 text-center">
          Nothing selected? We'll activate all categories by default.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          disabled={isSubmitting}
          className="text-slate-500 hover:text-slate-400 text-sm transition-colors disabled:opacity-50"
        >
          Skip setup →
        </button>
        <button
          onClick={handleContinue}
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
