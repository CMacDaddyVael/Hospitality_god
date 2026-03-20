import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { AuditResults } from './AuditResults'
import { AuditLoadingState } from './AuditLoadingState'

export const dynamic = 'force-dynamic'

type AuditPageProps = {
  params: { auditId: string }
}

export type AuditData = {
  id: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  listing_url: string | null
  overall_score: number | null
  summary: string | null
  categories: AuditCategory[] | null
  issues: AuditIssue[] | null
  created_at: string
  listing_title: string | null
}

export type AuditCategory = {
  name: string
  score: number
  finding: string
  icon: string
}

export type AuditIssue = {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

async function getAudit(auditId: string): Promise<AuditData | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env vars not set')
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error) {
    console.error('Error fetching audit:', error)
    return null
  }

  return data as AuditData
}

export default async function AuditPage({ params }: AuditPageProps) {
  const { auditId } = params
  const audit = await getAudit(auditId)

  if (!audit) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 px-6">
          <div className="text-5xl">🔍</div>
          <h1 className="text-2xl font-bold text-white">Audit not found</h1>
          <p className="text-slate-400 max-w-sm mx-auto">
            This audit link may have expired or the ID is incorrect. Try running a new free audit.
          </p>
          <a
            href="/audit"
            className="inline-block mt-4 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Run a free audit →
          </a>
        </div>
      </div>
    )
  }

  // If complete, render full results
  if (audit.status === 'complete') {
    return (
      <div className="min-h-screen bg-slate-950">
        <AuditResults audit={audit} />
      </div>
    )
  }

  // If pending/processing, render polling client component
  return (
    <div className="min-h-screen bg-slate-950">
      <AuditLoadingState auditId={auditId} initialStatus={audit.status} />
    </div>
  )
}
