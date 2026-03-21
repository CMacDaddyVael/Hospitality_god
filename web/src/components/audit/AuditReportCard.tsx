'use client'

import { useState } from 'react'
import type { AuditRecord, CategoryScore, AuditProblem } from '@/types/audit'
import { ScoreRing } from './ScoreRing'
import { CategoryCard } from './CategoryCard'
import { ProblemsList } from './ProblemsList'
import { UpgradeCTA } from './UpgradeCTA'

type Props = {
  audit: AuditRecord
}

export function AuditReportCard({ audit }: Props) {
  const score = audit.overall_score ?? 0
  const maxScore = audit.max_score ?? 100
  const categories = audit.categories ?? []
  const topProblems = audit.top_problems ?? []
  const title = audit.listing_title ?? 'Your Listing'

  const scoreLabel = getScoreLabel(score)
  const scoreColor = getScoreColor(score)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Sticky upgrade banner */}
      <div className="sticky top-0 z-50 bg-amber-400 text-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold hidden sm:block">
            🔧 Your listing has room to grow. Let VAEL fix it.
          </span>
          <span className="text-sm font-semibold sm:hidden">Fix your listing</span>
          <a
            href="/api/stripe/checkout?plan=pro"
            className="bg-slate-900 text-white text-sm font-bold px-4 py-1.5 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Fix this for $49/mo →
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Free Audit Complete
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {title}
          </h1>
          {audit.listing_url && (
            <a
              href={audit.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-slate-400 hover:text-amber-400 transition-colors truncate max-w-xs md:max-w-md"
            >
              {audit.listing_url}
            </a>
          )}
        </div>

        {/* Overall Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Score Ring */}
            <div className="flex-shrink-0">
              <ScoreRing score={score} maxScore={maxScore} color={scoreColor} />
            </div>

            {/* Score Context */}
            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <span
                  className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2"
                  style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
                >
                  {scoreLabel.grade}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  {scoreLabel.headline}
                </h2>
              </div>
              <p className="text-slate-400 text-base leading-relaxed max-w-lg">
                {scoreLabel.context}
              </p>
              {topProblems.length > 0 && (
                <div className="pt-2">
                  <span className="text-sm text-slate-500">
                    {topProblems.length} specific issue{topProblems.length !== 1 ? 's' : ''} found — see below
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {categories.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Score Breakdown</h2>
              <span className="text-xs text-slate-500 uppercase tracking-wide">by category</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {categories.map((cat) => (
                <CategoryCard key={cat.category} category={cat} />
              ))}
            </div>
          </section>
        )}

        {/* Problems List */}
        {topProblems.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">What Needs Fixing</h2>
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                {topProblems.length} issue{topProblems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ProblemsList problems={topProblems} />
          </section>
        )}

        {/* Inline Upgrade CTA */}
        <UpgradeCTA score={score} problemCount={topProblems.length} />

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-6">
          <p>Audit generated by VAEL Host · {new Date(audit.created_at).toLocaleDateString()}</p>
          <p className="mt-1">
            Questions?{' '}
            <a href="mailto:hello@vael.ai" className="text-slate-500 hover:text-white transition-colors">
              hello@vael.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function getScoreLabel(score: number): { grade: string; headline: string; context: string } {
  if (score >= 80) {
    return {
      grade: 'Strong',
      headline: 'Your listing is performing well',
      context:
        'You\'re ahead of most hosts — but there\'s still room to reach the top 10%. Small optimizations here can meaningfully lift conversion.',
    }
  }
  if (score >= 60) {
    return {
      grade: 'Average',
      headline: 'Your listing is leaving bookings on the table',
      context:
        'Most hosts score in this range. But average means you\'re losing bookings to better-optimized listings every day. The fixes are specific and actionable.',
    }
  }
  if (score >= 40) {
    return {
      grade: 'Needs Work',
      headline: 'Your listing has significant gaps',
      context:
        'Guests are landing on your page and leaving without booking. The issues below explain exactly why — and every one of them is fixable.',
    }
  }
  return {
    grade: 'Critical',
    headline: 'Your listing is seriously underperforming',
    context:
      'This score puts you at a major disadvantage in search. The good news: you have more to gain than almost any other host. These fixes have the highest possible impact.',
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#34d399' // emerald
  if (score >= 60) return '#fbbf24' // amber
  if (score >= 40) return '#f97316' // orange
  return '#f87171' // red
}
