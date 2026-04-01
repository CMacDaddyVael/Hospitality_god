import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export type CategoryScore = {
  name: string
  score: number
  max_score: number
  passed: boolean
  callouts: string[]
}

export type AuditData = {
  id: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  listing_url: string
  listing_title?: string
  listing_platform?: string
  overall_score?: number
  categories?: CategoryScore[]
  created_at: string
  completed_at?: string
  estimated_wait_seconds?: number
}

export async function getAuditById(id: string): Promise<AuditData | null> {
  // Validate UUID format to avoid unnecessary DB calls
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return null
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return data as AuditData
  } catch (err) {
    console.error('Error fetching audit:', err)
    return null
  }
}
