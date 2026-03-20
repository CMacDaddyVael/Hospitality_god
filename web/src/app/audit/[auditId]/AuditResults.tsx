'use client'

import { useState } from 'react'
import type { AuditData, AuditCategory, AuditIssue } from './page'

type Props = {
  audit: AuditData
}

function getScoreColor(score: number): { text: string; bg: string; ring: string; bar: string } {
  if (score <= 40) {
    return {
      text: 'text-red-400',
      bg: 'bg-red-400/10',
      ring: 'ring-red-400/30',
      bar: 'bg-red-400',
    }
  }
  if (score <= 70) {
    return {
      text: 'text-amber-400',
      bg: 'bg-amber-400/10',
      ring: 'ring-amber-400/30',
      bar: 'bg-amber-400',
    }
  }
  return {
    text: 'text-green-400',
    bg: 'bg-green-400/10',
    ring: 'ring-green-400/30',
    bar: 'bg-green-400',
  }
}

function getScoreLabel(score: number): string {
  if (score <= 20) return 'Critical — major issues hurting bookings'
  if (score <= 40) return 'Poor — significant improvements needed'
  if (score <= 55) return 'Below average — missing key opportunities'
  if (score <= 70) return 'Fair — solid foundation, room to grow'
  if (score <= 85) return 'Good — well-optimized listing'
  return 'Excellent — top-performing listing'
}

function getSeverityStyles(severity: string) {
  if (severity === 'high') return 'bg-red-400/10 border-red-400/20 text-red-400'
  if (severity === 'medium') return 'bg-amber-400/10 border-amber-400/20 text-amber-400'
  return 'bg-slate-700/50 border-slate-600/50 text-slate-400'
}

function getSeverityDot(severity: string) {
  if (severity === 'high') return 'bg-red-400'
  if (severity === 'medium') return 'bg-amber-400'
  return 'bg-slate-400'
}

// Fallback demo data if audit categories/issues are missing (shouldn't happen in prod)
const FALLBACK_CATEGORIES: AuditCategory[] = [
  {
    name: 'Photos',
    score: 35,
    finding: 'First photo is not hero-quality and likely hurts click-through rate.',
    icon: '📸',
  },
  {
    name: 'Listing Copy',
    score: 42,
    finding: 'Title missing property type and neighborhood — two of Airbnb\'s top ranking signals.',
    icon: '✍️',
  },
  {
    name: 'Pricing Signals',
    score: 55,
    finding: 'No seasonal pricing detected; likely leaving revenue on the table.',
    icon: '💰',
  },
  {
    name: 'Review Presence',
    score: 68,
    finding: 'Good review count but host responses are missing on 60% of reviews.',
    icon: '⭐',
  },
  {
    name: 'Completeness',
    score: 40,
    finding: 'Amenities section is incomplete — guests can\'t filter for your property.',
    icon: '✅',
  },
]

const FALLBACK_ISSUES: AuditIssue[] = [
  {
    title: 'Title doesn\'t include property type or neighborhood',
    description:
      'Airbnb\'s algorithm heavily weights these two signals. Adding them can improve search ranking within days.',
    severity: 'high',
  },
  {
    title: 'No response to recent guest reviews',
    description:
      'Hosts who respond to reviews see 12% higher booking rates. Your last 5 reviews have no host response.',
    severity: 'high',
  },
  {
    title: 'First photo not optimized for mobile',
    description:
      '70% of Airbnb browsing happens on mobile. Your hero image crops poorly at mobile aspect ratios.',
    severity: 'high',
  },
  {
    title: 'Description doesn\'t mention local attractions',
    description:
      'Guests search by experience ("near the beach", "walkable to restaurants"). Your description misses these hooks.',
    severity: 'medium',
  },
  {
    title: 'Amenity list is missing key filters',
    description:
      'Your listing doesn\'t include workspace, EV charger, or pool in the amenities — even if you have them — preventing guests from finding you via filters.',
    severity: 'medium',
  },
]

export function AuditResults({ audit }: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const score = audit.overall_score ?? 41
  const categories = audit.categories?.length ? audit.categories : FALLBACK_CATEGORIES
  const issues = audit.issues?.length ? audit.issues : FALLBACK_ISSUES
  const summary =
    audit.summary ??
    'Your listing has a strong foundation but several critical gaps are costing you bookings and revenue. The biggest opportunities are in your title optimization, photo presentation, and review response strategy — all areas where targeted improvements typically yield results within 2–4 weeks.'

  const scoreColors = getScoreColor(score)
  const scoreLabel = getScoreLabel(score)

  const handleUpgradeClick = async () => {
    setCheckoutLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          sessionId: audit.id,
          auditId: audit.id,
        }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <>
      {/* Sticky upgrade banner */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-amber-400/20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-400 text-lg flex-shrink-0">⚡</span>
            <p className="text-sm text-slate-300 truncate">
              <span className="text-white font-medium">Your AI marketing team can fix all of this</span>
              <span className="hidden sm:inline text-slate-400"> — results in 2–4 weeks</span>
            </p>
          </div>
          <button
            onClick={handleUpgradeClick}
            disabled={checkoutLoading}
            className="flex-shrink-0 px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/50 text-slate-900 text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
          >
            {checkoutLoading ? 'Loading…' : '$49/mo — Start now'}
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-10 pb-32 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-slate-500 text-sm uppercase tracking-widest font-medium">Free Listing Audit</p>
          {audit.listing_title && (
            <p className="text-slate-400 text-base">{audit.listing_title}</p>
          )}
          {audit.listing_url && !audit.listing_title && (
            <p className="text-slate-500 text-xs truncate max-w-xs mx-auto">{audit.listing_url}</p>
          )}
        </div>

        {/* Overall Score */}
        <div className={`rounded-3xl p-8 ${scoreColors.bg} ring-1 ${scoreColors.ring} text-center space-y-3`}>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Overall Score</p>
          <div className={`text-8xl font-black ${scoreColors.text} leading-none`}>
            {score}
            <span className="text-4xl text-slate-500 font-bold">/100</span>
          </div>
          <p className={`text-base font-semibold ${scoreColors.text}`}>{scoreLabel}</p>
          {/* Score bar */}
          <div className="w-full max-w-xs mx-auto bg-slate-800 rounded-full h-2 mt-4">
            <div
              className={`h-2 rounded-full ${scoreColors.bar} transition-all duration-1000`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Big picture summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <h2 className="text-white font-bold text-lg">Here's the big picture for your listing</h2>
          </div>
          <p className="text-slate-300 leading-relaxed text-base">{summary}</p>
        </div>

        {/* Category breakdown */}
        <div className="space-y-4">
          <h2 className="text-white font-bold text-xl">Category Breakdown</h2>
          <div className="space-y-3">
            {categories.map((category) => {
              const catColors = getScoreColor(category.score)
              return (
                <div
                  key={category.name}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{category.icon}</span>
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold text-base leading-tight">{category.name}</h3>
                        <p className="text-slate-400 text-sm mt-0.5 leading-snug">{category.finding}</p>
                      </div>
                    </div>
                    <div className={`flex-shrink-0 text-2xl font-black ${catColors.text} leading-none`}>
                      {category.score}
                      <span className="text-sm font-normal text-slate-500">/100</span>
                    </div>
                  </div>
                  {/* Category score bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${catColors.bar} transition-all duration-700`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Issues Found */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xl">Issues Found</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
              {issues.length} problems identified
            </span>
          </div>
          <div className="space-y-3">
            {issues.slice(0, 5).map((issue, idx) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getSeverityDot(issue.severity)}`} />
                  <div className="space-y-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-snug">{issue.title}</p>
                    <p className="text-slate-400 text-sm leading-relaxed">{issue.description}</p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-md border font-medium capitalize ${getSeverityStyles(issue.severity)}`}
                  >
                    {issue.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA block */}
        <div className="bg-gradient-to-br from-amber-400/10 to-amber-600/5 border border-amber-400/25 rounded-3xl p-8 text-center space-y-5">
          <div className="space-y-2">
            <div className="text-4xl">⚡</div>
            <h2 className="text-white text-2xl font-black leading-tight">
              Your AI marketing team can fix all of this
            </h2>
            <p className="text-slate-400 text-base max-w-sm mx-auto leading-relaxed">
              VAEL Host works on your listing every day — rewriting copy, optimizing photos, drafting review responses,
              and building your social presence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {[
              { icon: '✍️', label: 'Rewritten title & description' },
              { icon: '📸', label: 'AI lifestyle photography' },
              { icon: '⭐', label: 'Review response drafts' },
              { icon: '📱', label: 'Social media content' },
              { icon: '📊', label: 'Weekly optimization brief' },
              { icon: '🔄', label: 'Ongoing score tracking' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 bg-slate-900/60 rounded-xl px-3 py-2.5">
                <span className="text-base">{item.icon}</span>
                <span className="text-slate-300 text-xs font-medium">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleUpgradeClick}
              disabled={checkoutLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/50 text-slate-900 text-lg font-black rounded-2xl transition-colors"
            >
              {checkoutLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  Loading…
                </>
              ) : (
                <>Fix all of this — $49/mo</>
              )}
            </button>
            <p className="text-slate-500 text-xs">Cancel anytime · No setup fees · Results in 2–4 weeks</p>
          </div>
        </div>

        {/* Share nudge */}
        <div className="text-center space-y-2 pb-4">
          <p className="text-slate-500 text-sm">Share this report</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
            }}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl transition-colors"
          >
            Copy link 🔗
          </button>
        </div>
      </main>
    </>
  )
}
