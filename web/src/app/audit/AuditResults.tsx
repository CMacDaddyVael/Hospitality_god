'use client'

import type { AuditReport } from '@/lib/audit/types'

type Props = {
  report: AuditReport
  email: string
}

const SCORE_COLOR = (score: number) => {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

const SCORE_BG = (score: number) => {
  if (score >= 75) return 'bg-green-400/10 border-green-400/30'
  if (score >= 50) return 'bg-yellow-400/10 border-yellow-400/30'
  return 'bg-red-400/10 border-red-400/30'
}

const SCORE_LABEL = (score: number) => {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Average'
  if (score >= 35) return 'Below Average'
  return 'Needs Work'
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
}

export default function AuditResults({ report, email }: Props) {
  const overallColor = SCORE_COLOR(report.overallScore)
  const overallBg = SCORE_BG(report.overallScore)
  const overallLabel = SCORE_LABEL(report.overallScore)

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🏨</span>
          <span className="text-xl font-bold text-white tracking-tight">
            Hospitality<span className="text-amber-400">God</span>
          </span>
        </div>
        <p className="text-slate-400 text-sm">Free Listing Audit Report</p>
      </div>

      {/* Overall score card */}
      <div
        className={`border rounded-2xl p-8 text-center space-y-3 ${overallBg}`}
      >
        <p className="text-slate-400 text-sm uppercase tracking-widest">
          Overall Listing Score
        </p>
        <div className={`text-7xl font-extrabold ${overallColor}`}>
          {report.overallScore}
          <span className="text-3xl text-slate-500">/100</span>
        </div>
        <div
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${overallBg} ${overallColor}`}
        >
          {overallLabel}
        </div>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          {report.summary}
        </p>
      </div>

      {/* Listing title */}
      {report.listingTitle && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-5 py-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-0.5">
            Listing
          </p>
          <p className="text-white text-sm font-medium">{report.listingTitle}</p>
        </div>
      )}

      {/* Category breakdown */}
      <div>
        <h3 className="text-white font-semibold mb-3">Category Breakdown</h3>
        <div className="space-y-3">
          {report.categories.map((cat) => (
            <div
              key={cat.name}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-white text-sm font-medium">
                    {cat.name}
                  </span>
                </div>
                <span className={`text-lg font-bold ${SCORE_COLOR(cat.score)}`}>
                  {cat.score}
                </span>
              </div>
              {/* Score bar */}
              <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    cat.score >= 75
                      ? 'bg-green-400'
                      : cat.score >= 50
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  }`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
              {cat.callout && (
                <p className="text-slate-400 text-xs mt-2">{cat.callout}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Callouts / issues */}
      {report.callouts && report.callouts.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">
            What to fix first ({report.callouts.length} issue
            {report.callouts.length !== 1 ? 's' : ''} found)
          </h3>
          <div className="space-y-3">
            {report.callouts.map((callout, idx) => (
              <div
                key={idx}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-1.5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                      SEVERITY_BADGE[callout.severity] || SEVERITY_BADGE.info
                    }`}
                  >
                    {callout.severity}
                  </span>
                  <p className="text-white text-sm font-medium leading-snug">
                    {callout.title}
                  </p>
                </div>
                <p className="text-slate-400 text-sm ml-0 pl-0">
                  {callout.description}
                </p>
                {callout.fix && (
                  <p className="text-amber-400 text-xs font-medium">
                    💡 {callout.fix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upsell CTA */}
      <div className="bg-gradient-to-br from-amber-500/10 to-amber-400/5 border border-amber-400/30 rounded-2xl p-6 text-center space-y-4">
        <h3 className="text-white text-lg font-bold">
          Want us to fix all of this for you?
        </h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Hospitality God rewrites your listing, creates social content, and
          responds to reviews — every week, for $59/mo.
        </p>
        <a
          href={`/onboarding?email=${encodeURIComponent(email)}`}
          className="inline-block px-8 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-xl transition-all duration-200 text-sm"
        >
          Start Free Trial → $59/mo
        </a>
        <p className="text-slate-600 text-xs">Cancel anytime. No contracts.</p>
      </div>

      {/* Footer */}
      <p className="text-center text-slate-600 text-xs pb-4">
        Report sent to {email} · Powered by HospitalityGod.ai
      </p>
    </div>
  )
}
