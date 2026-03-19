'use client'

type Props = {
  score: number
}

function getScoreColor(score: number): { text: string; ring: string; bg: string; label: string } {
  if (score < 40) {
    return {
      text: 'text-red-400',
      ring: 'stroke-red-500',
      bg: 'stroke-red-950',
      label: 'Needs Work',
    }
  }
  if (score < 70) {
    return {
      text: 'text-yellow-400',
      ring: 'stroke-yellow-500',
      bg: 'stroke-yellow-950',
      label: 'Room to Improve',
    }
  }
  return {
    text: 'text-emerald-400',
    ring: 'stroke-emerald-500',
    bg: 'stroke-emerald-950',
    label: 'Looking Good',
  }
}

export function ScoreGauge({ score }: Props) {
  const colors = getScoreColor(score)
  const clampedScore = Math.max(0, Math.min(100, score))

  // SVG arc gauge
  const size = 200
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = Math.PI * radius // half circle arc length

  // We only draw a half circle (180 degrees, bottom open)
  // Start at 180deg (left), end at 0deg (right)
  // For a half-circle gauge: progress fills left to right
  const progress = (clampedScore / 100) * circumference
  const dashArray = `${progress} ${circumference}`

  // Center of SVG
  const cx = size / 2
  const cy = size / 2 + 20 // shift down slightly so arc sits nicely

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size / 2 + 30 }}>
        <svg
          width={size}
          height={size / 2 + 30}
          viewBox={`0 0 ${size} ${size / 2 + 30}`}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={describeArc(cx, cy, radius, 180, 360)}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="stroke-slate-800"
          />
          {/* Progress arc */}
          <path
            d={describeArc(cx, cy, radius, 180, 180 + 180 * (clampedScore / 100))}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colors.ring}
            style={{ transition: 'all 1s ease-out' }}
          />
        </svg>

        {/* Score number centered below arc */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className={`text-5xl md:text-6xl font-black tabular-nums ${colors.text}`}>
            {clampedScore}
          </div>
          <div className="text-slate-400 text-xs font-medium -mt-1">out of 100</div>
        </div>
      </div>

      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          score < 40
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : score < 70
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            score < 40 ? 'bg-red-400' : score < 70 ? 'bg-yellow-400' : 'bg-emerald-400'
          }`}
        />
        {colors.label}
      </span>
    </div>
  )
}

// Helpers to describe SVG arc paths
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}
