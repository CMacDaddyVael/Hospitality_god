'use client'

import type { PropertyData } from '@/app/dashboard/page'

type Props = {
  property: PropertyData
}

const SEVERITY_STYLES = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const SEVERITY_ICONS = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
}

export function PropertyOverview({ property }: Props) {
  const scoreColor =
    property.current_score >= 75
      ? 'text-emerald-400'
      : property.current_score >= 50
      ? 'text-amber-400'
      : 'text-red-400'

  const scoreRing =
    property.current_score >= 75
      ? 'ring-emerald-400/30 text-emerald-400'
      : property.current_score >= 50
      ? 'ring-amber-400/30 text-amber-400'
      : 'ring-red-400/30 text-red-400'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 h-full">
      {/* Property title + platform */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full capitalize">
            {property.platform}
          </span>
          {property.listing_url && (
            <a
              href={property.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
            >
              View listing ↗
            </a>
          )}
        </div>
        <h3 className="font-semibold text-white text-sm leading-tight">{property.title}</h3>
        <p className="text-slate-500 text-xs">{property.location}</p>
      </div>

      {/* Score badge */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-full ring-4 ${scoreRing} flex items-center justify-center bg-slate-800 flex-shrink-0`}>
          <span className={`text-xl font-bold ${scoreColor}`}>{property.current_score}</span>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Listing Score</div>
          <div className="flex items-center gap-1.5">
            {property.score_change !== 0 && (
              <span
                className={`text-xs font-medium ${
                  property.score_change > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {property.score_change > 0 ? '↑' : '↓'} {Math.abs(property.score_change)} pts
              </span>
            )}
            <span className="text-slate-500 text-xs">vs last month</span>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">Rating</div>
          <div className="font-semibold text-white text-sm">
            ⭐ {property.rating.toFixed(1)}
          </div>
          <div className="text-slate-500 text-xs">{property.review_count} reviews</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">Price / night</div>
          <div className="font-semibold text-white text-sm">
            ${property.price_per_night}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">Photos</div>
          <div className="font-semibold text-white text-sm">{property.photos_count}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3">
          <div className="text-xs text-slate-500 mb-1">Amenities</div>
          <div className="font-semibold text-white text-sm">{property.amenities_count}</div>
        </div>
      </div>

      {/* Issues */}
      {property.issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Issues to Fix
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {property.issues.slice(0, 5).map((issue, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${SEVERITY_STYLES[issue.severity]}`}
              >
                <span className="flex-shrink-0 mt-0.5">{SEVERITY_ICONS[issue.severity]}</span>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
