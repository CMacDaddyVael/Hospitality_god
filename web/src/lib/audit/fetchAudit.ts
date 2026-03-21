import { createClient } from '@supabase/supabase-js'
import type { AuditRecord } from '@/types/audit'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured')
  }

  return createClient(url, key)
}

export async function getAuditByPropertyId(propertyId: string): Promise<AuditRecord | null> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('property_audits')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // PGRST116 = no rows found
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[fetchAudit] Supabase error:', error)
      return null
    }

    return data as AuditRecord
  } catch (err) {
    console.error('[fetchAudit] Unexpected error:', err)
    return null
  }
}
