'use client'

type Props = {
  score: number
  maxScore: number
  color: string
  size?: number
  strokeWidth?: number
}

export function ScoreRing({
  score,
  maxScore,
  color,
  size = 160,
  strokeWidth = 12,
}: Props) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  // Start gap at bottom (small gap at 270deg = start at top)
  // We use a 270-degree arc leaving a 90-degree gap at the bottom
  const arcFraction = 0.75
  const dashArray = circumference * arcFraction
  const offset = circumference * arcFraction * (1 - pct / 100)

  // Rotate so the arc starts at the bottom-left
  const rotation = 135 // degrees — positions gap at bottom center

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${Math.max(0, dashArray - offset)} ${circumference}`}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>

      {/* Center text */}
      <div className="relative flex flex-col items-center justify-center">
        <span
          className="text-4xl font-black leading-none tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-slate-500 text-sm font-medium mt-0.5">/ {maxScore}</span>
      </div>
    </div>
  )
}
