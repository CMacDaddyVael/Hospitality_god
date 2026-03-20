'use client'

import { useEffect, useState, useCallback } from 'react'
import { AuditResults } from './AuditResults'
import type { AuditData } from './page'

type Props = {
  auditId: string
  initialStatus: 'pending' | 'processing' | 'failed'
}

const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 72 // 6 minutes max polling

const STATUS_MESSAGES = [
  'Fetching your listing details…',
  'Analyzing your photos…',
  'Reviewing your listing copy…',
  'Checking pricing signals…',
  'Auditing your review presence…',
  'Scoring completeness…',
  'Running AI analysis…',
  'Generating your report…',
  'Almost done…',
]

export function AuditLoadingState({ auditId, initialStatus }: Props) {
  const [status, setStatus] = useState<string>(initialStatus)
  const [completedAudit, setCompletedAudit] = useState<AuditData | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [failed, setFailed] = useState(initialStatus === 'failed')

  // Cycle through status messages to keep user engaged
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/status?auditId=${auditId}`)
      if (!res.ok) {
        console.error('Poll failed with status', res.status)
        return
      }
      const data = await res.json()

      setStatus(data.status)

      if (data.status === 'complete' && data.audit) {
        setCompletedAudit(data.audit)
      } else if (data.status === 'failed') {
        setFailed(true)
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }, [auditId])

  useEffect(() => {
    if (status === 'complete' || failed || timedOut) return

    const interval = setInterval(() => {
      setPollCount((prev) => {
        const next = prev + 1
        if (next >= MAX_POLLS) {
          setTimedOut(true)
          clearInterval(interval)
        }
        return next
      })
      poll()
    }, POLL_INTERVAL_MS)

    // Poll immediately on mount too
    poll()

    return () => clearInterval(interval)
  }, [poll, status, failed, timedOut])

  // Once complete, render results
  if (completedAudit) {
    return <AuditResults audit={completedAudit} />
  }

  if (failed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-2xl font-bold text-white">Audit failed</h1>
          <p className="text-slate-400">
            We weren't able to complete the audit for this listing. This can happen if the listing is
            private, has been removed, or we hit a temporary error.
          </p>
          <a
            href="/audit"
            className="inline-block px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Try again →
          </a>
        </div>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="text-5xl">⏳</div>
          <h1 className="text-2xl font-bold text-white">Still processing…</h1>
          <p className="text-slate-400">
            Your audit is taking longer than expected. Check back in a few minutes — we'll have
            your results ready.
          </p>
          <button
            onClick={() => {
              setTimedOut(false)
              setPollCount(0)
            }}
            className="inline-block px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Keep waiting
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-8 max-w-sm w-full">
        {/* Animated logo / spinner area */}
        <div className="space-y-4">
          <div className="relative inline-flex items-center justify-center">
            {/* Outer ring */}
            <div className="w-24 h-24 rounded-full border-4 border-slate-800" />
            {/* Spinning arc */}
            <div className="absolute w-24 h-24 rounded-full border-4 border-transparent border-t-amber-400 animate-spin" />
            {/* Center icon */}
            <div className="absolute text-3xl">🏡</div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Auditing your listing…</h1>
          <p className="text-amber-400 text-sm font-medium min-h-[20px] transition-all duration-500">
            {STATUS_MESSAGES[messageIndex]}
          </p>
          <p className="text-slate-500 text-xs">
            This usually takes 30–60 seconds. Don't close this tab.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-slate-700 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>

        {/* What we're checking */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left space-y-3">
          <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">Checking</p>
          {[
            { icon: '📸', label: 'Photos & visual quality' },
            { icon: '✍️', label: 'Title & description copy' },
            { icon: '💰', label: 'Pricing competitiveness' },
            { icon: '⭐', label: 'Review quality & responses' },
            { icon: '✅', label: 'Listing completeness' },
          ].map((item, idx) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm">{item.icon}</span>
              <span className="text-slate-400 text-sm">{item.label}</span>
              <div className="ml-auto">
                <div
                  className="w-4 h-4 rounded-full border-2 border-transparent border-t-amber-400/60 animate-spin"
                  style={{ animationDuration: `${1 + idx * 0.3}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
