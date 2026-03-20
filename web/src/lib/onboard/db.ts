/**
 * Database operations for the onboard pipeline.
 * Wraps Supabase calls for properties, audits, and deliverables.
 * Issue #171
 */

import { createClient } from '@supabase/supabase-js'
import type { ScrapedProperty, AuditScore } from './types'

// ---------------------------------------------------------------------------
// Supabase client (service-role key so we can write without RLS)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Types for DB rows (minimal — only what we write/read)
// ---------------------------------------------------------------------------

export interface PropertyRow {
  id: string
  airbnb_url: string
  canonical_url: string
  email: string
  title: string
  description: string
  property_type: string
  location: string
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  amenities: string[]
  photos: string[]
  rating: number | null
  review_count: number | null
  price_per_night: number | null
  host_name: string | null
  host_since: string | null
  superhost: boolean
  instant_book: boolean
  created_at: string
}

export interface AuditRow {
  id: string
  property_id: string
  score: number
  score_breakdown: Record<string, number>
  grade: string
  flags: string[]
  created_at: string
}

export interface DeliverableRow {
  id: string
  property_id: string
  audit_id: string
  type: string
  status: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

const IDEMPOTENCY_WINDOW_HOURS = 24

/**
 * Returns an existing { property_id, audit_id } if the same URL+email was
 * submitted within the last 24 hours, otherwise null.
 */
export async function findExistingAudit(
  canonicalUrl: string,
  email: string
): Promise<{ property_id: string; audit_id: string; score: number; score_breakdown: Record<string, number> } | null> {
  const supabase = getSupabase()

  const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data: properties, error: propErr } = await supabase
    .from('properties')
    .select('id')
    .eq('canonical_url', canonicalUrl)
    .eq('email', email)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  if (propErr || !properties || properties.length === 0) return null

  const propertyId = properties[0].id

  const { data: audits, error: auditErr } = await supabase
    .from('audits')
    .select('id, score, score_breakdown')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (auditErr || !audits || audits.length === 0) return null

  return {
    property_id: propertyId,
    audit_id: audits[0].id,
    score: audits[0].score,
    score_breakdown: audits[0].score_breakdown,
  }
}

// ---------------------------------------------------------------------------
// Write operations (all-or-nothing via sequential inserts with cleanup)
// ---------------------------------------------------------------------------

export async function persistOnboardData(
  property: ScrapedProperty,
  audit: AuditScore,
  email: string
): Promise<{ property_id: string; audit_id: string }> {
  const supabase = getSupabase()

  // 1. Insert property row
  const { data: propData, error: propErr } = await supabase
    .from('properties')
    .insert({
      airbnb_url: property.airbnb_url,
      canonical_url: property.canonical_url,
      email,
      title: property.title,
      description: property.description,
      property_type: property.property_type,
      location: property.location,
      city: property.city,
      state: property.state,
      country: property.country,
      latitude: property.latitude,
      longitude: property.longitude,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      max_guests: property.max_guests,
      amenities: property.amenities,
      photos: property.photos,
      rating: property.rating,
      review_count: property.review_count,
      price_per_night: property.price_per_night,
      host_name: property.host_name,
      host_since: property.host_since,
      superhost: property.superhost,
      instant_book: property.instant_book,
    })
    .select('id')
    .single()

  if (propErr || !propData) {
    throw new Error(`Failed to insert property: ${propErr?.message ?? 'unknown error'}`)
  }

  const propertyId: string = propData.id

  // 2. Insert audit row
  const { data: auditData, error: auditErr } = await supabase
    .from('audits')
    .insert({
      property_id: propertyId,
      score: audit.total,
      score_breakdown: audit.breakdown,
      grade: audit.grade,
      flags: audit.flags,
    })
    .select('id')
    .single()

  if (auditErr || !auditData) {
    // Attempt cleanup — best effort
    await supabase.from('properties').delete().eq('id', propertyId)
    throw new Error(`Failed to insert audit: ${auditErr?.message ?? 'unknown error'}`)
  }

  const auditId: string = auditData.id

  // 3. Seed initial deliverable row (listing_copy, pending)
  const { error: deliverableErr } = await supabase.from('deliverables').insert({
    property_id: propertyId,
    audit_id: auditId,
    type: 'listing_copy',
    status: 'pending',
  })

  if (deliverableErr) {
    // Deliverable failure is non-fatal — log and continue
    console.error('[onboard/db] deliverable insert failed:', deliverableErr.message)
  }

  return { property_id: propertyId, audit_id: auditId }
}
