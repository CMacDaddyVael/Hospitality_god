import type { AuditScoreResult } from './audit-types'

// In-memory store for dev/demo when Supabase is not configured
const DEV_AUDIT_STORE: Record<string, AuditScoreResult> = {}

export async function getAuditResult(id: string): Promise<AuditScoreResult | null> {
  // Check in-memory dev store first (populated by seed script / API)
  if (DEV_AUDIT_STORE[id]) {
    return DEV_AUDIT_STORE[id]
  }

  // Try Supabase if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })

      const { data, error } = await supabase
        .from('audit_results')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Supabase fetch error:', error.message)
        return null
      }

      return data as AuditScoreResult
    } catch (err) {
      console.error('Supabase client error:', err)
    }
  }

  return null
}

export function seedDevAudit(audit: AuditScoreResult) {
  DEV_AUDIT_STORE[audit.id] = audit
}

export { DEV_AUDIT_STORE }
