/**
 * ScoreHistory — Score trajectory chart component
 *
 * Renders a line chart of score-over-time for a property,
 * with a summary callout ("Improved X points this month").
 *
 * New file — does not modify any existing component.
 * Uses Recharts (lightweight, already common in Next.js projects).
 */

'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreRecord {
  id: string
  property_id: string
  score: number
  category_scores: Record<string, number>
  scored_at: string
}

interface ScoreHistoryData {
  success: boolean
  records: ScoreRecord[]
  monthlyDelta: number | null
  monthStartScore: number | null
  latestScore: number | null
}

interface ScoreHistoryProps {
  propertyId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonth(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getDeltaLabel(delta: number | null, monthStartScore: number | null, latestScore: number | null): {
  text: string
  color: string
  icon: string
} {
  if (delta === null || monthStartScore === null || latestScore === null) {
    return { text: 'No data this month', color: 'text-slate-400', icon: '—' }
  }
  if (delta > 0) {
    return {
      text: `Score improved ${delta} point${delta !== 1 ? 's' : ''} this month`,
      color: 'text-emerald-400',
      icon: '↑',
    }
  }
  if (delta < 0) {
    return {
      text: `Score down ${Math.abs(delta)} point${Math.abs(delta) !== 1 ? 's' : ''} this month`,
      color: 'text-red-400',
      icon: '↓',
    }
  }
  return { text: 'No change this month', color: 'text-slate-400', icon: '→' }
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { scored_at: string } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const record = payload[0]
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{formatDate(record.payload.scored_at)}</p>
      <p className="text-white font-bold text-lg">{record.value}<span className="text-slate-400 text-sm font-normal">/100</span></p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single score badge (shown when only 1 data point exists)
// ---------------------------------------------------------------------------

function SingleScoreBadge({ score, scoredAt }: { score: number; scoredAt: string }) {
  const color =
    score >= 70
      ? 'from-emerald-500 to-emerald-600'
      : score >= 50
      ? 'from-amber-500 to-amber-600'
      : 'from-red-500 to-red-600'

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div
        className={`w-28 h-28 rounded-full bg-gradient-to-br ${color} flex flex-col items-center justify-center shadow-lg`}
      >
        <span className="text-white text-3xl font-bold leading-none">{score}</span>
        <span className="text-white/70 text-xs mt-0.5">/ 100</span>
      </div>
      <div className="text-center space-y-1">
        <p className="text-slate-300 text-sm font-medium">Your current listing score</p>
        <p className="text-slate-500 text-xs">First scored {formatDate(scoredAt)}</p>
        <p className="text-slate-500 text-xs mt-2">
          Your score history chart will appear after your next weekly re-audit.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score color for YAxis domain visualization
// ---------------------------------------------------------------------------

function scoreColor(score: number | null): string {
  if (score === null) return '#94a3b8'
  if (score >= 70) return '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ScoreHistory({ propertyId, className = '' }: ScoreHistoryProps) {
  const [data, setData] = useState<ScoreHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!propertyId) return
    setLoading(true)
    setError(null)

    fetch(`/api/score-history?propertyId=${encodeURIComponent(propertyId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load score history')
        return res.json()
      })
      .then((json: ScoreHistoryData) => {
        setData(json)
      })
      .catch((err) => {
        console.error('[ScoreHistory]', err)
        setError('Could not load score history.')
      })
      .finally(() => setLoading(false))
  }, [propertyId])

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-white font-semibold">Score History</h2>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading score history…</p>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <h2 className="text-white font-semibold">Score History</h2>
        </div>
        <p className="text-slate-500 text-sm text-center py-8">
          {error ?? 'No score data available.'}
        </p>
      </div>
    )
  }

  const { records, monthlyDelta, monthStartScore, latestScore } = data
  const deltaInfo = getDeltaLabel(monthlyDelta, monthStartScore, latestScore)

  // ---------------------------------------------------------------------------
  // Empty state (no scores at all)
  // ---------------------------------------------------------------------------
  if (records.length === 0) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <h2 className="text-white font-semibold">Score History</h2>
        </div>
        <p className="text-slate-500 text-sm text-center py-8">
          Your listing hasn't been scored yet. Run an audit to get started.
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Single data point — show badge, no chart
  // ---------------------------------------------------------------------------
  if (records.length === 1) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <h2 className="text-white font-semibold">Score History</h2>
        </div>
        <SingleScoreBadge score={records[0].score} scoredAt={records[0].scored_at} />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Multi-point — render chart
  // ---------------------------------------------------------------------------

  // Prepare chart data
  const chartData = records.map((r) => ({
    ...r,
    label: formatDate(r.scored_at),
  }))

  // Compute Y-axis domain with padding
  const scores = records.map((r) => r.score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)

  // Month boundaries for reference lines
  const now = new Date()
  const monthStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString()

  // Find chart index of month start boundary
  const monthBoundaryIndex = records.findIndex(
    (r) => new Date(r.scored_at) >= new Date(monthStartIso)
  )

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: scoreColor(latestScore) }}
          />
          <h2 className="text-white font-semibold">Score History</h2>
        </div>
        {latestScore !== null && (
          <div className="flex items-center gap-1.5">
            <span
              className="text-2xl font-bold"
              style={{ color: scoreColor(latestScore) }}
            >
              {latestScore}
            </span>
            <span className="text-slate-500 text-sm">/100</span>
          </div>
        )}
      </div>

      {/* Monthly delta callout */}
      <div className="mb-5 bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
        <span
          className={`text-xl font-bold ${deltaInfo.color} leading-none`}
          aria-hidden
        >
          {deltaInfo.icon}
        </span>
        <div>
          <p className={`text-sm font-medium ${deltaInfo.color}`}>
            {deltaInfo.text}
          </p>
          {monthStartScore !== null && latestScore !== null && monthlyDelta !== 0 && (
            <p className="text-slate-500 text-xs mt-0.5">
              {monthStartScore} → {latestScore} in {formatMonth(new Date().toISOString())}
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-52" aria-label="Score history line chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minScore, maxScore]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Month boundary reference line */}
            {monthBoundaryIndex > 0 && (
              <ReferenceLine
                x={chartData[monthBoundaryIndex]?.label}
                stroke="#334155"
                strokeDasharray="4 2"
                label={{
                  value: 'This month',
                  position: 'insideTopRight',
                  fill: '#475569',
                  fontSize: 10,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="score"
              stroke={scoreColor(latestScore)}
              strokeWidth={2.5}
              dot={{ fill: scoreColor(latestScore), r: 3.5, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }}
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown (if available on latest record) */}
      {records.length > 0 &&
        Object.keys(records[records.length - 1].category_scores ?? {}).length > 0 && (
          <CategoryBreakdown
            categories={records[records.length - 1].category_scores}
          />
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category breakdown sub-component
// ---------------------------------------------------------------------------

function CategoryBreakdown({ categories }: { categories: Record<string, number> }) {
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <div className="mt-5 pt-4 border-t border-slate-700/50">
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-3">
        Latest score breakdown
      </p>
      <div className="space-y-2">
        {entries.map(([category, score]) => (
          <div key={category} className="flex items-center gap-3">
            <span className="text-slate-400 text-xs capitalize w-32 shrink-0">
              {category.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, score))}%`,
                  backgroundColor: scoreColor(score),
                }}
              />
            </div>
            <span
              className="text-xs font-medium w-8 text-right"
              style={{ color: scoreColor(score) }}
            >
              {score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
