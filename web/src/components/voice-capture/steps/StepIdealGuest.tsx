'use client'

import { useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

const GUEST_EXAMPLES = [
  'Couples on romantic getaways',
  'Families with young kids',
  'Remote workers & digital nomads',
  'Adventure travelers & hikers',
  'Luxury travelers & honeymooners',
  'Groups of friends celebrating',
]

export function StepIdealGuest({ value, onChange, onNext, onBack }: Props) {
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
          Describe your ideal guest
        </h2>
        <p className="text-slate-400 text-sm">
          Who do you light up when you see their booking? Your AI will write content that
          attracts more of them.
        </p>
      </div>

      {/* Quick-pick chips */}
      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Quick picks</p>
        <div className="flex flex-wrap gap-2">
          {GUEST_EXAMPLES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange(value === g ? '' : g)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all duration-150 ${
                value === g
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Free-text */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 uppercase tracking-wide">
          Or describe in your own words
        </label>
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (touched && e.target.value.trim()) setTouched(false)
          }}
          placeholder="e.g. Couples celebrating anniversaries who appreciate quiet evenings and local restaurant recommendations…"
          rows={3}
          className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors text-sm resize-none leading-relaxed ${
            showError
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-600 focus:ring-amber-400/30 focus:border-amber-400'
          }`}
          aria-describedby={showError ? 'guest-error' : undefined}
        />
        {showError && (
          <p id="guest-error" className="text-red-400 text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Please describe your ideal guest before continuing
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/30"
        >
          ← Back
        </button>
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
