'use client'

import { useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onNext: () => void
}

const SUGGESTIONS = [
  'Warm, attentive, local',
  'Minimalist, peaceful, design-forward',
  'Fun, adventurous, welcoming',
  'Luxurious, private, curated',
  'Cozy, homey, family-friendly',
]

export function StepHostingStyle({ value, onChange, onNext }: Props) {
  const [touched, setTouched] = useState(false)
  const isEmpty = !value.trim()
  const showError = touched && isEmpty

  const handleNext = () => {
    setTouched(true)
    if (!isEmpty) onNext()
  }

  return (
    <div className="space-y-6">
      {/* Question */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">
          Describe your hosting style in 3 words
        </h2>
        <p className="text-slate-400 text-sm">
          These words will anchor every piece of content your AI creates. Be honest, not aspirational.
        </p>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (touched && e.target.value.trim()) setTouched(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
          placeholder="e.g. Warm, attentive, local"
          maxLength={100}
          className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors text-sm ${
            showError
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-600 focus:ring-amber-400/30 focus:border-amber-400'
          }`}
          aria-describedby={showError ? 'style-error' : undefined}
        />
        {showError && (
          <p id="style-error" className="text-red-400 text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Please describe your hosting style before continuing
          </p>
        )}
      </div>

      {/* Suggestion chips */}
      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Need inspiration?</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all duration-150 ${
                value === s
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
