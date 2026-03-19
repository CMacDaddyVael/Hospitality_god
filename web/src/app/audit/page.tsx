'use client'

import { Suspense } from 'react'
import AuditFlow from './AuditFlow'

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-slate-400 animate-pulse">Loading…</div>
        </div>
      }
    >
      <AuditFlow />
    </Suspense>
  )
}
