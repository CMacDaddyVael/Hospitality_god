'use client'

type Props = {
  score: number | null
  label: string
  sublabel?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreRing(score: number): string {
  if (score >= 80) return 'stroke-emerald-400'
  if (score >= 60) return 'stroke-amber-400'
  if (score >= 40) return 'stroke-orange-400'
  return 'stroke-red-400'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Needs Work'
  return 'Critical'
}

export function ScoreCard({ score, label, sublabel }: Props) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? (score / 100) * circumference : 0
  const dashoffset = circumference - progress

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-5">
      {/* Circular progress */}
      <div className="relative flex-shrink-0">
        <svg width="88" height="88" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
          />
          {/* Progress ring */}
          {score !== null && (
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              className={`${getScoreRing(score)} transition-all duration-700`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {score !== null ? (
            <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
          ) : (
            <span className="text-slate-600 text-sm">—</span>
          )}
        </div>
      </div>

      {/* Label */}
      <div>
        <p className="text-slate-400 text-sm font-medium">{label}</p>
        {score !== null ? (
          <>
            <p className={`text-lg font-semibold mt-0.5 ${getScoreColor(score)}`}>
              {getScoreLabel(score)}
            </p>
            {sublabel && <p className="text-slate-600 text-xs mt-0.5">{sublabel}</p>}
          </>
        ) : (
          <p className="text-slate-500 text-sm mt-0.5">No data yet</p>
        )}
      </div>
    </div>
  )
}
