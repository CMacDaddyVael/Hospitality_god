'use client'

import { useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

export function StepReviewResponse({ value, onChange, onNext, onBack }: Props) {
  const [touched, setTouched] = useState(false)
  const isEmpty = !value.trim()
  const showError = touched && isEmpty

  const handleNext = () => {
    setTouched(true)
    if (!isEmpty) onNext()
  }

  const charCount = value.length
  const isShort = charCount > 0 && charCount < 50

  return (
    <div className="space-y-6">
      {/* Question */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">
          Paste a review response you've written before
        </h2>
        <p className="text-slate-400 text-sm">
          This is the single most powerful signal for your AI. A real response you wrote
          teaches it your sentence structure, warmth level, and personal touches.
        </p>
      </div>

      {/* Example */}
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Example</p>
        <p className="text-slate-400 text-sm italic leading-relaxed">
          "Thank you so much for your kind words, Sarah! It was such a joy hosting you and
          the family. The mountain hike tip I mentioned — did you manage to catch the sunrise?
          Hope you'll come back next fall! — Mike"
        </p>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (touched && e.target.value.trim()) setTouched(false)
          }}
          placeholder="Paste or type a review response you've written…"
          rows={5}
          className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors text-sm resize-none leading-relaxed ${
            showError
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-slate-600 focus:ring-amber-400/30 focus:border-amber-400'
          }`}
          aria-describedby={showError ? 'review-error' : isShort ? 'review-hint' : undefined}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            {showError && (
              <p id="review-error" className="text-red-400 text-xs flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Please paste a review response before continuing
              </p>
            )}
            {isShort && !showError && (
              <p id="review-hint" className="text-amber-400/70 text-xs">
                More detail helps the AI learn your voice better
              </p>
            )}
          </div>
          <span className="text-xs text-slate-600 flex-shrink-0">{charCount} chars</span>
        </div>
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
