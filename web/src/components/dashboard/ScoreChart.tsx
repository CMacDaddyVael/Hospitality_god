'use client'

import { useEffect, useRef } from 'react'
import type { ScoreHistory } from '@/app/dashboard/page'

type Props = {
  scoreHistory: ScoreHistory[]
  currentScore: number
  scoreChange: number
}

export function ScoreChart({ scoreHistory, currentScore, scoreChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || scoreHistory.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const W = rect.width
    const H = rect.height
    const PADDING = { top: 20, right: 20, bottom: 40, left: 40 }
    const chartW = W - PADDING.left - PADDING.right
    const chartH = H - PADDING.top - PADDING.bottom

    ctx.clearRect(0, 0, W, H)

    const scores = scoreHistory.map((s) => s.score)
    const minScore = Math.max(0, Math.min(...scores) - 10)
    const maxScore = Math.min(100, Math.max(...scores) + 10)
    const range = maxScore - minScore || 10

    const toX = (i: number) => PADDING.left + (i / (scoreHistory.length - 1 || 1)) * chartW
    const toY = (score: number) => PADDING.top + chartH - ((score - minScore) / range) * chartH

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PADDING.top + (i / 4) * chartH
      ctx.beginPath()
      ctx.moveTo(PADDING.left, y)
      ctx.lineTo(PADDING.left + chartW, y)
      ctx.stroke()

      // Y axis labels
      const labelScore = Math.round(maxScore - (i / 4) * range)
      ctx.fillStyle = 'rgba(148,163,184,0.6)'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(String(labelScore), PADDING.left - 6, y + 4)
    }

    // Area fill under line
    const gradient = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + chartH)
    gradient.addColorStop(0, 'rgba(251,191,36,0.25)')
    gradient.addColorStop(1, 'rgba(251,191,36,0)')

    ctx.beginPath()
    ctx.moveTo(toX(0), toY(scores[0]))
    for (let i = 1; i < scores.length; i++) {
      const x0 = toX(i - 1)
      const x1 = toX(i)
      const y0 = toY(scores[i - 1])
      const y1 = toY(scores[i])
      const cpx = (x0 + x1) / 2
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1)
    }
    ctx.lineTo(toX(scores.length - 1), PADDING.top + chartH)
    ctx.lineTo(toX(0), PADDING.top + chartH)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(scores[0]))
    for (let i = 1; i < scores.length; i++) {
      const x0 = toX(i - 1)
      const x1 = toX(i)
      const y0 = toY(scores[i - 1])
      const y1 = toY(scores[i])
      const cpx = (x0 + x1) / 2
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1)
    }
    ctx.strokeStyle = '#FBbf24'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Data points + labels
    scoreHistory.forEach((point, i) => {
      const x = toX(i)
      const y = toY(point.score)

      // Dot
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#FBbf24'
      ctx.fill()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.stroke()

      // X axis label (date or label)
      const label = point.label ?? new Date(point.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ctx.fillStyle = 'rgba(148,163,184,0.7)'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, PADDING.top + chartH + 18)
    })

    // Current score label on last point
    if (scores.length > 0) {
      const lastX = toX(scores.length - 1)
      const lastY = toY(scores[scores.length - 1])
      ctx.fillStyle = '#FBbf24'
      ctx.font = 'bold 12px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(String(scores[scores.length - 1]), lastX, lastY - 12)
    }
  }, [scoreHistory])

  const scoreLabel =
    currentScore >= 75 ? 'Great' : currentScore >= 50 ? 'Good' : currentScore >= 30 ? 'Fair' : 'Needs Work'

  const scoreLabelColor =
    currentScore >= 75
      ? 'text-emerald-400 bg-emerald-400/10'
      : currentScore >= 50
      ? 'text-amber-400 bg-amber-400/10'
      : 'text-red-400 bg-red-400/10'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">Listing Score Over Time</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Track your optimization progress
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-2xl font-bold text-white">{currentScore}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreLabelColor}`}>
              {scoreLabel}
            </span>
          </div>
          {scoreChange !== 0 && (
            <div
              className={`text-xs font-medium mt-0.5 ${
                scoreChange > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {scoreChange > 0 ? '↑' : '↓'} {Math.abs(scoreChange)} pts this month
            </div>
          )}
        </div>
      </div>

      {scoreHistory.length < 2 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-3xl">📈</div>
            <p className="text-slate-400 text-sm">Score history will appear here</p>
            <p className="text-slate-600 text-xs">Check back after your first optimization cycle</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-[200px]">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ minHeight: 200 }}
          />
        </div>
      )}
    </div>
  )
}
