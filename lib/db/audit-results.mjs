/**
 * Audit Results Persistence Layer
 * Issue #223 — Save audit scores and findings to Supabase for dashboard retrieval
 *
 * This module is the read/write interface between the audit scoring engine
 * (Issue #212) and the Supabase database. The audit results page (Issue #196)
 * and monthly improvement reports read from these tables.
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.'
    )
  }

  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript so the file stays .mjs compatible)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AuditFinding
 * @property {string} category        - e.g. "photos", "title", "description", "amenities", "pricing"
 * @property {string} finding_text    - Human-readable description of what's wrong
 * @property {'low'|'medium'|'high'} severity
 * @property {string} recommendation_text - Actionable fix for the finding
 */

/**
 * @typedef {Object} CategoryScore
 * @property {string} category
 * @property {number} score           - 0-100
 */

/**
 * @typedef {Object} AuditOutput
 * @property {string}          listing_url    - Full Airbnb/Vrbo URL
 * @property {string}          [listing_id]   - Platform listing ID if extractable
 * @property {number}          overall_score  - 0-100
 * @property {CategoryScore[]} [category_scores]
 * @property {AuditFinding[]}  findings
 * @property {string}          [scraped_at]   - ISO timestamp of when scrape happened
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a platform listing ID from an Airbnb or Vrbo URL.
 * Returns null if it can't be determined.
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractListingId(url) {
  if (!url) return null

  try {
    // Airbnb: airbnb.com/rooms/12345678  or  airbnb.com/h/my-place
    const airbnbRooms = url.match(/airbnb\.com\/rooms\/(\d+)/)
    if (airbnbRooms) return airbnbRooms[1]

    // Airbnb short: airbnb.com/h/slug — no numeric ID, return slug
    const airbnbSlug = url.match(/airbnb\.com\/h\/([^/?#]+)/)
    if (airbnbSlug) return airbnbSlug[1]

    // Vrbo: vrbo.com/1234567  or  vrbo.com/p1234567
    const vrbo = url.match(/vrbo\.com\/p?(\d+)/)
    if (vrbo) return vrbo[1]
  } catch {
    // Ignore parse errors
  }

  return null
}

/**
 * Normalise a severity value so it always comes out as low/medium/high.
 *
 * @param {string} raw
 * @returns {'low'|'medium'|'high'}
 */
function normaliseSeverity(raw) {
  const s = (raw || '').toLowerCase().trim()
  if (s === 'high') return 'high'
  if (s === 'medium' || s === 'med') return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// saveAuditResults
// ---------------------------------------------------------------------------

/**
 * Persist a complete audit to Supabase.
 *
 * Writes to `listing_audits` and `audit_findings` atomically (sequential
 * inserts — if the findings insert fails the audit row is deleted so we
 * don't end up with orphaned header rows).
 *
 * @param {AuditOutput} auditOutput  - Output from the scoring engine
 * @param {string}      email        - Owner email (used for retrieval)
 * @returns {Promise<{ auditId: string }>}
 */
export async function saveAuditResults(auditOutput, email) {
  if (!auditOutput || typeof auditOutput !== 'object') {
    throw new Error('saveAuditResults: auditOutput is required')
  }
  if (!email || typeof email !== 'string') {
    throw new Error('saveAuditResults: email is required')
  }

  const supabase = getSupabaseClient()

  const {
    listing_url,
    listing_id: providedListingId,
    overall_score,
    category_scores = [],
    findings = [],
    scraped_at,
  } = auditOutput

  if (!listing_url) throw new Error('saveAuditResults: auditOutput.listing_url is required')
  if (typeof overall_score !== 'number') {
    throw new Error('saveAuditResults: auditOutput.overall_score must be a number')
  }

  const listing_id = providedListingId || extractListingId(listing_url)
  const scrapedAtValue = scraped_at || new Date().toISOString()

  // ------------------------------------------------------------------
  // 1. Insert the audit header row
  // ------------------------------------------------------------------
  const { data: auditRow, error: auditError } = await supabase
    .from('listing_audits')
    .insert({
      listing_url,
      listing_id: listing_id || null,
      owner_email: email.toLowerCase().trim(),
      overall_score,
      category_scores: category_scores.length > 0 ? category_scores : null,
      scraped_at: scrapedAtValue,
    })
    .select('id')
    .single()

  if (auditError) {
    throw new Error(`Failed to save audit header: ${auditError.message}`)
  }

  const auditId = auditRow.id

  // ------------------------------------------------------------------
  // 2. Insert findings (if any) — rollback header row on failure
  // ------------------------------------------------------------------
  if (findings.length > 0) {
    const findingRows = findings.map((f) => ({
      audit_id: auditId,
      category: f.category || 'general',
      finding_text: f.finding_text || '',
      severity: normaliseSeverity(f.severity),
      recommendation_text: f.recommendation_text || '',
    }))

    const { error: findingsError } = await supabase
      .from('audit_findings')
      .insert(findingRows)

    if (findingsError) {
      // Best-effort rollback — delete the orphaned audit header
      await supabase.from('listing_audits').delete().eq('id', auditId)

      throw new Error(`Failed to save audit findings (audit rolled back): ${findingsError.message}`)
    }
  }

  return { auditId }
}

// ---------------------------------------------------------------------------
// getLatestAuditByEmail
// ---------------------------------------------------------------------------

/**
 * Retrieve the most recent audit and all its findings for a given owner email.
 *
 * @param {string} email
 * @returns {Promise<{ audit: object, findings: object[] } | null>}
 */
export async function getLatestAuditByEmail(email) {
  if (!email) throw new Error('getLatestAuditByEmail: email is required')

  const supabase = getSupabaseClient()
  const normalisedEmail = email.toLowerCase().trim()

  // Fetch the most recent audit for this email
  const { data: audit, error: auditError } = await supabase
    .from('listing_audits')
    .select('*')
    .eq('owner_email', normalisedEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (auditError) {
    // PostgREST returns a 406 / "No rows found" error when .single() finds nothing —
    // treat that as a null result rather than throwing.
    if (
      auditError.code === 'PGRST116' ||
      auditError.message?.toLowerCase().includes('no rows')
    ) {
      return null
    }
    throw new Error(`Failed to fetch latest audit: ${auditError.message}`)
  }

  if (!audit) return null

  // Fetch all findings for that audit
  const { data: findings, error: findingsError } = await supabase
    .from('audit_findings')
    .select('*')
    .eq('audit_id', audit.id)
    .order('severity', { ascending: false }) // high → medium → low

  if (findingsError) {
    throw new Error(`Failed to fetch audit findings: ${findingsError.message}`)
  }

  return {
    audit,
    findings: findings || [],
  }
}

// ---------------------------------------------------------------------------
// getAuditHistory
// ---------------------------------------------------------------------------

/**
 * Return all historical { score, scraped_at, created_at } rows for a given
 * email, ordered oldest → newest — suitable for score-over-time charting.
 *
 * @param {string} email
 * @returns {Promise<Array<{ id: string, overall_score: number, scraped_at: string, created_at: string }>>}
 */
export async function getAuditHistory(email) {
  if (!email) throw new Error('getAuditHistory: email is required')

  const supabase = getSupabaseClient()
  const normalisedEmail = email.toLowerCase().trim()

  const { data, error } = await supabase
    .from('listing_audits')
    .select('id, overall_score, scraped_at, created_at, listing_url')
    .eq('owner_email', normalisedEmail)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch audit history: ${error.message}`)
  }

  return data || []
}

// ---------------------------------------------------------------------------
// getAuditById  (convenience — used by audit results page)
// ---------------------------------------------------------------------------

/**
 * Fetch a single audit and its findings by audit ID.
 *
 * @param {string} auditId
 * @returns {Promise<{ audit: object, findings: object[] } | null>}
 */
export async function getAuditById(auditId) {
  if (!auditId) throw new Error('getAuditById: auditId is required')

  const supabase = getSupabaseClient()

  const { data: audit, error: auditError } = await supabase
    .from('listing_audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError) {
    if (
      auditError.code === 'PGRST116' ||
      auditError.message?.toLowerCase().includes('no rows')
    ) {
      return null
    }
    throw new Error(`Failed to fetch audit by ID: ${auditError.message}`)
  }

  if (!audit) return null

  const { data: findings, error: findingsError } = await supabase
    .from('audit_findings')
    .select('*')
    .eq('audit_id', auditId)
    .order('severity', { ascending: false })

  if (findingsError) {
    throw new Error(`Failed to fetch findings for audit ${auditId}: ${findingsError.message}`)
  }

  return {
    audit,
    findings: findings || [],
  }
}
