'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryScores = Record<string, number>

type ScoreEntry = {
  scored_at: string
  total_score: number
  category_scores: CategoryScores | null
}

type ScoreHistoryResponse = {
  listing_id: string
  history: ScoreEntry[]
  delta: number
  first_score: number | null
  current_score: number | null
  count: number
}

type ChartDataPoint = {
  date: string
  score: number
  rawDate: string
}

type Props = {
  listingId: string
  authToken?: string
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

type TooltipPayload = {
  value: number
  payload: ChartDataPoint
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-lg">{entry.value} / 100</p>
    </div>
  )
}

// ─── Custom Dot Label (score value above each point) ─────────────────────────

function ScoreLabel(props: {
  x?: number
  y?: number
  value?: number | string
}) {
  const { x, y, value } = props
  if (x === undefined || y === undefined || value === undefined) return null
  return (
    <text
      x={x}
      y={y - 10}
      fill="#fbbf24"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
    >
      {value}
    </text>
  )
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, firstScore }: { delta: number; firstScore: number | null }) {
  const isPositive = delta > 0
  const isNeutral = delta === 0

  const colorClass = isPositive
    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : isNeutral
    ? 'text-slate-400 bg-slate-700/50 border-slate-600'
    : 'text-red-400 bg-red-400/10 border-red-400/20'

  const icon = isPositive ? '↑' : isNeutral ? '→' : '↓'
  const label = isPositive ? `+${delta}` : `${delta}`

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${colorClass}`}>
      <span>{icon}</span>
      <span>{label} pts since you started</span>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 bg-slate-700 rounded" />
        <div className="h-7 w-36 bg-slate-700 rounded-full" />
      </div>
      <div className="h-56 bg-slate-800/50 rounded-xl border border-slate-700" />
    </div>
  )
}

// ─── Single Point State ───────────────────────────────────────────────────────

function SinglePointView({ entry, delta }: { entry: ScoreEntry; delta: number }) {
  const dateLabel = new Date(entry.scored_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 text-center">
      {/* Single score badge */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-5xl font-extrabold text-white">
          {entry.total_score}
          <span className="text-2xl text-slate-400 font-normal"> / 100</span>
        </div>
        <p className="text-slate-500 text-sm">{dateLabel}</p>
      </div>

      {/* Inline progress arc placeholder */}
      <div className="w-full max-w-xs bg-slate-800 border border-slate-700 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs">Score</span>
          <span className="text-amber-400 font-semibold text-sm">{entry.total_score}/100</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-amber-400 h-2 rounded-full transition-all duration-700"
            style={{ width: `${entry.total_score}%` }}
          />
        </div>
      </div>

      {/* Empty state message */}
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
        We&apos;ll track your score improvement here — check back after your next optimization cycle
      </p>

      <DeltaBadge delta={delta} firstScore={entry.total_score} />
    </div>
  )
}

// ─── Main Chart Component ─────────────────────────────────────────────────────

export function ScoreHistoryChart({ listingId, authToken }: Props) {
  const [data, setData] = useState<ScoreHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await fetch(`/api/listings/${listingId}/score-history`, { headers })

      if (!res.ok) {
        if (res.status === 401) {
          setError('Please sign in to view score history.')
        } else if (res.status === 404) {
          setError('Listing not found.')
        } else {
          setError('Failed to load score history.')
        }
        return
      }

      const json: ScoreHistoryResponse = await res.json()
      setData(json)
    } catch (err) {
      console.error('Score history fetch error:', err)
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [listingId, authToken])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <ChartSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-red-400">
          <span className="text-lg">⚠️</span>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || data.count === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span>📈</span> Score History
        </h3>
        <p className="text-slate-400 text-sm text-center py-8">
          No audit data yet — run your first listing audit to start tracking.
        </p>
      </div>
    )
  }

  // ── Single audit entry ──────────────────────────────────────────────────────
  if (data.count === 1) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span>📈</span> Score History
        </h3>
        <SinglePointView entry={data.history[0]} delta={data.delta} />
      </div>
    )
  }

  // ── Multi-point chart ───────────────────────────────────────────────────────

  const chartData: ChartDataPoint[] = data.history.map((entry) => ({
    rawDate: entry.scored_at,
    date: new Date(entry.scored_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    score: entry.total_score,
  }))

  const scores = chartData.map((d) => d.score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span>📈</span> Score History
        </h3>
        <DeltaBadge delta={data.delta} firstScore={data.first_score} />
      </div>

      {/* Sub-stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-center">
          <p className="text-slate-500 text-xs mb-0.5">First Score</p>
          <p className="text-white font-bold text-lg">{data.first_score ?? '—'}</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-center">
          <p className="text-slate-500 text-xs mb-0.5">Current Score</p>
          <p className="text-amber-400 font-bold text-lg">{data.current_score ?? '—'}</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5 text-center">
          <p className="text-slate-500 text-xs mb-0.5">Audits Run</p>
          <p className="text-white font-bold text-lg">{data.count}</p>
        </div>
      </div>

      {/* Recharts line chart */}
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 16, left: -10, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[minScore, maxScore]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* 50-point reference line as a subtle mid-point guide */}
            <ReferenceLine
              y={50}
              stroke="#475569"
              strokeDasharray="4 4"
              label={{ value: '50', fill: '#64748b', fontSize: 10, position: 'insideLeft' }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#fbbf24"
              strokeWidth={2.5}
              dot={{ fill: '#fbbf24', r: 5, strokeWidth: 2, stroke: '#1e293b' }}
              activeDot={{ fill: '#fbbf24', r: 7, strokeWidth: 2, stroke: '#1e293b' }}
            >
              <LabelList dataKey="score" content={<ScoreLabel />} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-slate-600 text-xs text-right">
        Last updated: {new Date(data.history[data.history.length - 1].scored_at).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
    </div>
  )
}
