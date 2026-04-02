'use client'

import { useState } from 'react'
import type { ListingData } from '../OnboardingWizard'

type Props = {
  initialData?: ListingData
  onComplete: (data: ListingData) => void
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

function extractListingId(url: string): string | null {
  // Airbnb: /rooms/12345678 or /h/some-slug
  const airbnbMatch = url.match(/airbnb\.[a-z.]+\/rooms\/(\d+)/)
  if (airbnbMatch) return airbnbMatch[1]

  // Vrbo: /1234567 or /homeaway/1234567
  const vrboMatch = url.match(/vrbo\.com\/(\d+)/)
  if (vrboMatch) return vrboMatch[1]

  return null
}

function validateUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return 'Please enter your listing URL'

  try {
    const parsed = new URL(trimmed)
    const isAirbnb =
      parsed.hostname.includes('airbnb.com') &&
      (parsed.pathname.includes('/rooms/') || parsed.pathname.includes('/h/'))
    const isVrbo =
      parsed.hostname.includes('vrbo.com') || parsed.hostname.includes('homeaway.com')

    if (!isAirbnb && !isVrbo) {
      return 'Please enter a valid Airbnb or Vrbo listing URL'
    }
    return null
  } catch {
    return 'Please enter a valid URL (starting with https://)'
  }
}

// Manual entry form shown when scraping fails
function ManualEntryForm({
  url,
  onSubmit,
}: {
  url: string
  onSubmit: (data: ListingData) => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    propertyType: 'Entire home',
    location: '',
    pricePerNight: '',
    beds: '',
    baths: '',
    maxGuests: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Required'
    if (!form.location.trim()) e.location = 'Required'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    const platform = url.includes('vrbo.com') ? 'vrbo' : 'airbnb'
    const listingId = extractListingId(url) ?? `manual-${Date.now()}`

    onSubmit({
      url,
      listingId,
      title: form.title.trim(),
      description: form.description.trim(),
      photos: [],
      amenities: [],
      reviews: [],
      rating: 0,
      reviewCount: 0,
      propertyType: form.propertyType,
      location: form.location.trim(),
      pricePerNight: parseFloat(form.pricePerNight) || 0,
      beds: parseInt(form.beds) || undefined,
      baths: parseInt(form.baths) || undefined,
      maxGuests: parseInt(form.maxGuests) || undefined,
      platform,
      isManualEntry: true,
    })
  }

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder: string,
    type = 'text'
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }))
          setErrors((er) => ({ ...er, [key]: '' }))
        }}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
          errors[key] ? 'border-red-500' : 'border-slate-600 focus:border-amber-400'
        }`}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-400">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <p className="text-xs font-medium text-amber-400">
        Enter your property details manually — we'll still run all the same optimizations.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {field('title', 'Listing Title *', 'Cozy Mountain Cabin with Hot Tub')}
        </div>
        {field('location', 'Location *', 'Asheville, NC')}
        {field('propertyType', 'Property Type', 'Entire home')}
        {field('pricePerNight', 'Price per night ($)', '189', 'number')}
        {field('beds', 'Bedrooms', '2', 'number')}
        {field('baths', 'Bathrooms', '1', 'number')}
        {field('maxGuests', 'Max Guests', '4', 'number')}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Description (optional)
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe your property..."
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-300"
      >
        Continue with manual entry →
      </button>
    </div>
  )
}

export function Step1ListingUrl({ initialData, onComplete }: Props) {
  const [url, setUrl] = useState(initialData?.url ?? '')
  const [urlError, setUrlError] = useState('')
  const [fetchState, setFetchState] = useState<FetchState>(
    initialData ? 'success' : 'idle'
  )
  const [fetchError, setFetchError] = useState('')
  const [scrapedData, setScrapedData] = useState<ListingData | null>(initialData ?? null)
  const [showManualEntry, setShowManualEntry] = useState(false)

  const handleFetch = async () => {
    const validationError = validateUrl(url)
    if (validationError) {
      setUrlError(validationError)
      return
    }

    setUrlError('')
    setFetchError('')
    setFetchState('loading')
    setScrapedData(null)
    setShowManualEntry(false)

    try {
      const res = await fetch('/api/onboarding/scrape-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to fetch listing')
      }

      setScrapedData(json.listing)
      setFetchState('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch listing data'
      setFetchError(msg)
      setFetchState('error')
    }
  }

  const handleManualComplete = (data: ListingData) => {
    onComplete(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-2xl">
          🏡
        </div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Connect your listing</h1>
        <p className="mx-auto max-w-md text-sm text-slate-400 md:text-base">
          Paste your Airbnb or Vrbo listing URL. We'll automatically pull in your property
          details, photos, and reviews.
        </p>
      </div>

      {/* URL Input Card */}
      <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
        <label className="block text-sm font-medium text-slate-300">Listing URL</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setUrlError('')
              if (fetchState === 'success') {
                setScrapedData(null)
                setFetchState('idle')
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            placeholder="https://www.airbnb.com/rooms/12345678"
            className={`flex-1 rounded-xl border bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
              urlError ? 'border-red-500' : 'border-slate-600 focus:border-amber-400'
            }`}
            autoFocus
          />
          <button
            onClick={handleFetch}
            disabled={fetchState === 'loading' || !url.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {fetchState === 'loading' ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Fetching…
              </>
            ) : (
              'Import listing'
            )}
          </button>
        </div>
        {urlError && <p className="text-xs text-red-400">{urlError}</p>}

        {/* Platform hints */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Works with:</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-red-400">●</span> Airbnb
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-blue-400">●</span> Vrbo
          </span>
        </div>
      </div>

      {/* Loading state */}
      {fetchState === 'loading' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
            <svg className="h-8 w-8 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Importing your listing…</p>
          <p className="mt-1 text-xs text-slate-500">
            Fetching title, description, photos, and reviews
          </p>
        </div>
      )}

      {/* Error state */}
      {fetchState === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-red-400">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Couldn't fetch listing data</p>
              <p className="mt-0.5 text-xs text-red-400/80">
                {fetchError}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleFetch}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                >
                  Try again
                </button>
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="rounded-lg border border-amber-400/40 px-4 py-2 text-xs font-medium text-amber-400 transition-colors hover:border-amber-400"
                >
                  Enter details manually instead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual entry form */}
      {showManualEntry && fetchState === 'error' && (
        <ManualEntryForm url={url} onSubmit={handleManualComplete} />
      )}

      {/* Success: scraped preview */}
      {fetchState === 'success' && scrapedData && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-green-300">Listing imported successfully!</p>
            </div>
          </div>

          {/* Preview card */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
            {scrapedData.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scrapedData.photos[0]}
                alt={scrapedData.title}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-white line-clamp-2">{scrapedData.title}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {scrapedData.location && <span>📍 {scrapedData.location}</span>}
                {scrapedData.propertyType && <span>🏠 {scrapedData.propertyType}</span>}
                {scrapedData.rating > 0 && (
                  <span>⭐ {scrapedData.rating.toFixed(1)} ({scrapedData.reviewCount} reviews)</span>
                )}
                {scrapedData.pricePerNight > 0 && (
                  <span>💰 ${scrapedData.pricePerNight}/night</span>
                )}
              </div>
              {scrapedData.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {scrapedData.amenities.slice(0, 5).map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {a}
                    </span>
                  ))}
                  {scrapedData.amenities.length > 5 && (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                      +{scrapedData.amenities.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onComplete(scrapedData)}
            className="w-full rounded-xl bg-amber-400 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-300"
          >
            Looks good — continue →
          </button>
        </div>
      )}
    </div>
  )
}
