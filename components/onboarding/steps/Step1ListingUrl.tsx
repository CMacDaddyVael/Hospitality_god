'use client'

import { useState } from 'react'
import type { ListingData } from '../OnboardingWizard'

type Props = {
  initialData?: ListingData
  onComplete: (data: ListingData) => void
}

export function Step1ListingUrl({ initialData, onComplete }: Props) {
  const [url, setUrl] = useState(initialData?.url || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [scrapedData, setScrapedData] = useState<ListingData | null>(initialData || null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter your listing URL')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/onboarding/scrape-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch listing. Please check the URL.')
        return
      }

      setScrapedData(data.listing)
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleContinue = () => {
    if (scrapedData) {
      onComplete(scrapedData)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mb-2">
          <span className="text-2xl">🏡</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Connect your listing
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto">
          Paste your Airbnb or Vrbo listing URL and we'll automatically pull in your
          property details, photos, and reviews.
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-medium text-slate-300">
          Listing URL
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError('')
              setScrapedData(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            placeholder="https://airbnb.com/rooms/12345678"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
          />
          <button
            onClick={handleScrape}
            disabled={isLoading || !url.trim()}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold rounded-xl transition-all duration-200 text-sm whitespace-nowrap"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </span>
            ) : (
              'Analyze Listing'
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Supports Airbnb (airbnb.com/rooms/...) and Vrbo (vrbo.com/...) listings
        </p>
      </div>

      {/* Scraped data preview */}
      {scrapedData && (
        <div className="bg-slate-800/50 border border-green-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-sm">Listing found!</span>
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-semibold text-lg leading-tight">
              {scrapedData.title}
            </h3>

            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <span>📍</span> {scrapedData.location}
              </span>
              <span className="flex items-center gap-1">
                <span>⭐</span> {scrapedData.rating} ({scrapedData.reviewCount} reviews)
              </span>
              <span className="flex items-center gap-1">
                <span>💰</span> ${scrapedData.pricePerNight}/night
              </span>
            </div>

            {scrapedData.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {scrapedData.photos.slice(0, 4).map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt={`Property photo ${i + 1}`}
                    className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-900/50 rounded-xl p-3">
                <div className="text-amber-400 font-bold text-lg">{scrapedData.photos.length}</div>
                <div className="text-slate-500 text-xs mt-0.5">Photos found</div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3">
                <div className="text-amber-400 font-bold text-lg">{scrapedData.amenities.length}</div>
                <div className="text-slate-500 text-xs mt-0.5">Amenities</div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3">
                <div className="text-amber-400 font-bold text-lg">{scrapedData.reviews.length}</div>
                <div className="text-slate-500 text-xs mt-0.5">Reviews</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            Continue with this listing
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* What we'll do */}
      {!scrapedData && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            What we'll automatically pull in:
          </h3>
          <ul className="space-y-2">
            {[
              { icon: '📸', text: 'All listing photos for social content' },
              { icon: '✍️', text: 'Title and description to analyze and optimize' },
              { icon: '🏊', text: 'Full amenities list for content generation' },
              { icon: '⭐', text: 'Guest reviews to draft your responses' },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-400">
                <span>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
