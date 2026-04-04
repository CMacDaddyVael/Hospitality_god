'use client'

import { useState } from 'react'
import type { VibeKeyword } from '../SubscriberOnboarding'

type Props = {
  initialKeywords: VibeKeyword[]
  initialBrandNotes: string
  onComplete: (keywords: VibeKeyword[], brandNotes: string) => void
  onBack: () => void
  onSkip: () => void
  isSubmitting: boolean
}

type VibeOption = {
  id: VibeKeyword
  label: string
  emoji: string
}

const VIBE_OPTIONS: VibeOption[] = [
  { id: 'cozy_cabin', label: 'Cozy Cabin', emoji: '🪵' },
  { id: 'luxury_beachfront', label: 'Luxury Beachfront', emoji: '🌊' },
  { id: 'family_friendly', label: 'Family-Friendly', emoji: '👨‍👩‍👧‍👦' },
  { id: 'romantic_getaway', label: 'Romantic Getaway', emoji: '🌹' },
  { id: 'adventure_basecamp', label: 'Adventure Basecamp', emoji: '🏔️' },
  { id: 'urban_chic', label: 'Urban Chic', emoji: '🏙️' },
  { id: 'mountain_retreat', label: 'Mountain Retreat', emoji: '⛰️' },
  { id: 'lakeside_escape', label: 'Lakeside Escape', emoji: '🏞️' },
  { id: 'pet_friendly_haven', label: 'Pet-Friendly Haven', emoji: '🐾' },
  { id: 'remote_work_ready', label: 'Remote Work Ready', emoji: '💻' },
  { id: 'boho_bungalow', label: 'Boho Bungalow', emoji: '🪴' },
  { id: 'modern_minimalist', label: 'Modern Minimalist', emoji: '◻️' },
]

const MIN_KEYWORDS = 3
const MAX_KEYWORDS = 5

export function StepPropertyVibe({
  initialKeywords,
  initialBrandNotes,
  onComplete,
  onBack,
  onSkip,
  isSubmitting,
}: Props) {
  const [selected, setSelected] = useState<Set<VibeKeyword>>(new Set(initialKeywords))
  const [brandNotes, setBrandNotes] = useState(initialBrandNotes)
  const [validationError, setValidationError] = useState('')

  const toggle = (id: VibeKeyword) => {
    setValidationError('')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_KEYWORDS) {
          setValidationError(`Pick up to ${MAX_KEYWORDS} keywords.`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const handleContinue = () => {
    if (selected.size < MIN_KEYWORDS) {
      setValidationError(`Please select at least ${MIN_KEYWORDS} keywords that describe your property.`)
      return
    }
    onComplete(Array.from(selected) as VibeKeyword[], brandNotes)
  }

  const canContinue = selected.size >= MIN_KEYWORDS

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">
          What's your property's vibe?
        </h2>
        <p className="text-slate-400 text-sm">
          Select {MIN_KEYWORDS}–{MAX_KEYWORDS} keywords. Your AI team will use these to match your brand's voice and tone.
        </p>
      </div>

      {/* Keyword pills */}
      <div className="flex flex-wrap gap-2">
        {VIBE_OPTIONS.map((vibe) => {
          const isSelected = selected.has(vibe.id)
          const isDisabled = !isSelected && selected.size >= MAX_KEYWORDS
          return (
            <button
              key={vibe.id}
              onClick={() => !isDisabled && toggle(vibe.id)}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                isSelected
                  ? 'bg-amber-400 border-amber-400 text-slate-900'
                  : isDisabled
                  ? 'border-slate-700 text-slate-600 bg-slate-800/30 cursor-not-allowed'
                  : 'border-slate-600 text-slate-300 bg-slate-800/50 hover:border-amber-400/50 hover:text-white'
              }`}
            >
              <span>{vibe.emoji}</span>
              <span>{vibe.label}</span>
              {isSelected && (
                <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      {/* Selection counter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: MAX_KEYWORDS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-5 rounded-full transition-all duration-200 ${
                i < selected.size ? 'bg-amber-400' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {selected.size} / {MAX_KEYWORDS} selected
          {selected.size < MIN_KEYWORDS && ` — need ${MIN_KEYWORDS - selected.size} more`}
        </span>
      </div>

      {validationError && (
        <p className="text-xs text-red-400">{validationError}</p>
      )}

      {/* Brand notes */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Brand notes{' '}
          <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={brandNotes}
          onChange={(e) => setBrandNotes(e.target.value)}
          placeholder="e.g. 'We want guests to feel like they're staying at a friend's place, not a hotel. Warm, unpretentious, genuine.'"
          rows={3}
          className="w-full bg-slate-900/80 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 text-sm resize-none"
        />
        <p className="text-xs text-slate-500">
          Anything else that describes your property's personality or what makes it special.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-slate-400 text-sm transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-slate-400 text-sm transition-colors disabled:opacity-50"
          >
            Skip setup →
          </button>
        </div>
        <button
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
