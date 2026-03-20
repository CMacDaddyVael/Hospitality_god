import type { AuditScoreResult } from '@/lib/audit-types'
import { ScoreRing } from './ScoreRing'
import { CategoryBars } from './CategoryBars'
import { RecommendationList } from './RecommendationList'
import { UpgradeCTA } from './UpgradeCTA'

type Props = {
  audit: AuditScoreResult
}

export function AuditReportCard({ audit }: Props) {
  const scoreColor =
    audit.overall_score <= 40
      ? 'text-red-400'
      : audit.overall_score <= 70
        ? 'text-amber-400'
        : 'text-emerald-400'

  const scoreLabel =
    audit.overall_score <= 40
      ? 'your listing is losing bookings to competitors'
      : audit.overall_score <= 70
        ? 'your listing has significant room to grow'
        : 'your listing is performing well — let\'s make it great'

  const criticalCount = audit.recommendations.filter((r) => r.severity === 'critical').length
  const importantCount = audit.recommendations.filter((r) => r.severity === 'important').length

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top nav bar */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              Hospitality<span className="text-amber-400">God</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
            <span>Free audit</span>
            <span className="text-slate-600">•</span>
            <span className="text-white font-medium">{audit.listing_title}</span>
          </div>
        </div>
      </header>

      {/* Page layout: 2-col on desktop, single col on mobile */}
      <div className="max-w-5xl mx-auto px-4 py-6 lg:py-8 pb-36 lg:pb-12 lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
        {/* ── MAIN CONTENT ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero score block */}
          <section className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-slate-400 text-sm uppercase tracking-widest font-medium mb-4">
              Your Listing Score
            </p>

            <ScoreRing score={audit.overall_score} />

            <h1 className={`text-xl sm:text-2xl font-bold mt-4 ${scoreColor}`}>
              {audit.overall_score}/100 —
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-1 max-w-sm mx-auto">
              {scoreLabel}
            </p>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto">
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
                <p className="text-xs text-slate-400 mt-1">Critical fixes</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-2xl font-bold text-amber-400">{importantCount}</p>
                <p className="text-xs text-slate-400 mt-1">Important fixes</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-2xl font-bold text-slate-300">
                  {audit.recommendations.length}
                </p>
                <p className="text-xs text-slate-400 mt-1">Total actions</p>
              </div>
            </div>

            {/* Listing meta */}
            {(audit.listing_title || audit.location) && (
              <div className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-2">
                {audit.location && <span>📍 {audit.location}</span>}
                {audit.property_type && (
                  <>
                    <span>•</span>
                    <span>{audit.property_type}</span>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Category breakdown */}
          <section className="bg-slate-900 rounded-2xl p-6 sm:p-8">
            <h2 className="text-base font-semibold text-white mb-5">Category Breakdown</h2>
            <CategoryBars categories={audit.categories} />
          </section>

          {/* Fix recommendations */}
          <section className="bg-slate-900 rounded-2xl p-6 sm:p-8">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-base font-semibold text-white">
                What to Fix — Prioritized
              </h2>
              <span className="text-xs text-slate-500">
                {audit.recommendations.length} actions
              </span>
            </div>
            <RecommendationList recommendations={audit.recommendations} />
          </section>

          {/* Mobile CTA hint — above the sticky bar */}
          <div className="lg:hidden text-center py-2">
            <p className="text-xs text-slate-500">
              Your AI marketing team can fix all of this automatically ↓
            </p>
          </div>
        </div>

        {/* ── DESKTOP SIDEBAR CTA ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <UpgradeCTA auditId={audit.id} score={audit.overall_score} />
          </div>
        </aside>
      </div>

      {/* ── MOBILE STICKY BOTTOM BAR ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 py-3 safe-area-bottom">
        <MobileCtaBar auditId={audit.id} score={audit.overall_score} />
      </div>
    </div>
  )
}

function MobileCtaBar({ auditId, score }: { auditId: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">
          Your AI marketing team is ready
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Fix your score with one click
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <span className="text-lg font-bold text-white">$59</span>
          <span className="text-slate-400 text-xs">/mo</span>
        </div>
        <a
          href={`/api/stripe/checkout?plan=pro&audit=${auditId}`}
          className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors"
        >
          Start Fixing This
        </a>
      </div>
    </div>
  )
}
