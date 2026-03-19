'use client'

import { useEffect, useState } from 'react'

type Props = {
  url: string
}

const STAGES = [
  { icon: '🔍', label: 'Fetching listing data…', duration: 4000 },
  { icon: '📸', label: 'Analysing photos & title…', duration: 5000 },
  { icon: '📝', label: 'Reading description & amenities…', duration: 5000 },
  { icon: '⭐', label: 'Processing reviews…', duration: 4000 },
  { icon: '🧠', label: 'Scoring your listing…', duration: 6000 },
  { icon: '📋', label: 'Building your report card…', duration: 4000 },
]

export default function AuditRunning({ url }: Props) {
  const [stageIndex, setStageIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // Advance stages with realistic timing
    let cumulative = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    STAGES.forEach((stage, i) => {
      const t = setTimeout(() => {
        setStageIndex(i)
      }, cumulative)
      timers.push(t)
      cumulative += stage.duration
    })

    // Elapsed counter
    const interval = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(interval)
    }
  }, [])

  const currentStage = STAGES[Math.min(stageIndex, STAGES.length - 1)]
  const progressPct = Math.min(
    ((stageIndex + 1) / STAGES.length) * 100,
    95 // never hit 100 until actually done
  )

  return (
    <div className="w-full max-w-md text-center space-y-8">
      {/* Animated icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-amber-400/10 border-2 border-amber-400/30 flex items-center justify-center animate-pulse">
          <span className="text-4xl">{currentStage.icon}</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Running your audit…</h2>
        <p className="text-slate-400 text-sm">{currentStage.label}</p>
        <p className="text-slate-600 text-xs">{elapsed}s elapsed</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stage checklist */}
      <div className="text-left space-y-2">
        {STAGES.map((stage, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 text-sm transition-all duration-300 ${
              i < stageIndex
                ? 'text-slate-400'
                : i === stageIndex
                ? 'text-white'
                : 'text-slate-600'
            }`}
          >
            <span className="text-base">
              {i < stageIndex ? '✅' : i === stageIndex ? '⏳' : '○'}
            </span>
            {stage.label}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600">
        This usually takes 15–30 seconds
      </p>
    </div>
  )
}
