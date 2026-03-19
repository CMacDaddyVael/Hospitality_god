'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmailGate from './EmailGate'
import AuditRunning from './AuditRunning'
import AuditResults from './AuditResults'
import AuditError from './AuditError'
import type { AuditReport } from '@/lib/audit/types'

type FlowStep = 'email' | 'running' | 'results' | 'error'

export default function AuditFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stepParam = searchParams.get('step') as FlowStep | null

  const [step, setStep] = useState<FlowStep>(stepParam || 'email')
  const [url, setUrl] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [report, setReport] = useState<AuditReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Pull URL from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('audit_url')
    if (!stored) {
      router.replace('/')
      return
    }
    setUrl(stored)
  }, [router])

  const handleEmailSubmit = useCallback(
    async (submittedEmail: string) => {
      setEmail(submittedEmail)
      setStep('running')

      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, email: submittedEmail }),
        })

        const data = await res.json()

        if (!res.ok) {
          setErrorMessage(data.error || 'Something went wrong. Please try again.')
          setStep('error')
          return
        }

        setReport(data.report)
        setStep('results')
        // Clean up sessionStorage
        sessionStorage.removeItem('audit_url')
      } catch (err) {
        console.error('Audit fetch error:', err)
        setErrorMessage(
          'Network error — please check your connection and try again.'
        )
        setStep('error')
      }
    },
    [url]
  )

  const handleRetry = () => {
    router.push('/')
  }

  if (!url && step !== 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Preparing audit…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-12">
      {step === 'email' && (
        <EmailGate url={url} onSubmit={handleEmailSubmit} />
      )}
      {step === 'running' && <AuditRunning url={url} />}
      {step === 'results' && report && (
        <AuditResults report={report} email={email} />
      )}
      {step === 'error' && (
        <AuditError message={errorMessage} onRetry={handleRetry} />
      )}
    </div>
  )
}
