import { scrapeListingForAudit } from './scraper'
import { scoreListing } from './scorer'
import { generateAuditSummary } from './claude-summary'
import { persistAudit } from './persist'
import type { AuditResult, PipelineInput } from './types'

/**
 * End-to-end audit pipeline:
 * URL → scrape → score → Claude summary → persist → return structured result
 */
export async function runAuditPipeline(input: PipelineInput): Promise<AuditResult> {
  const { url, userId, sessionId } = input
  const startedAt = Date.now()

  console.log(`[pipeline] Starting audit for ${url}`)

  // ── Step 1: Scrape ──────────────────────────────────────────────────────
  console.log('[pipeline] Step 1: scraping listing...')
  const listing = await scrapeListingForAudit(url)
  console.log(`[pipeline] Scraped: "${listing.title}" (${listing.photos.length} photos)`)

  // ── Step 2: Score ───────────────────────────────────────────────────────
  console.log('[pipeline] Step 2: scoring listing...')
  const scoreResult = scoreListing(listing)
  console.log(`[pipeline] Score: ${scoreResult.overall}/100`)

  // ── Step 3: Claude summary ──────────────────────────────────────────────
  console.log('[pipeline] Step 3: generating Claude recommendations...')
  const summary = await generateAuditSummary({ listing, scoreResult })
  console.log(`[pipeline] Generated ${summary.recommendations.length} recommendations`)

  // ── Assemble result ─────────────────────────────────────────────────────
  const elapsed = Date.now() - startedAt
  console.log(`[pipeline] Completed in ${elapsed}ms`)

  const result: AuditResult = {
    url,
    listing,
    score: scoreResult,
    summary,
    completedAt: new Date().toISOString(),
    durationMs: elapsed,
  }

  // ── Step 4: Persist (non-blocking on failure) ───────────────────────────
  try {
    const auditId = await persistAudit({ result, userId, sessionId })
    result.auditId = auditId
    console.log(`[pipeline] Persisted as audit ${auditId}`)
  } catch (err) {
    // Persistence failure should NOT fail the audit response
    console.error('[pipeline] Persist failed (non-fatal):', err)
  }

  return result
}
