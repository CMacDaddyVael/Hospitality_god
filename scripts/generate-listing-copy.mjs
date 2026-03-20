#!/usr/bin/env node
/**
 * Manual trigger script for listing copy optimization pipeline.
 * Issue #137 — for testing with a real listing_id and audit_id.
 *
 * Usage:
 *   node scripts/generate-listing-copy.mjs <listing_id> <audit_id>
 *
 * Or with env vars:
 *   LISTING_ID=abc123 AUDIT_ID=def456 node scripts/generate-listing-copy.mjs
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env from repo root and web/.env.local (web subproject)
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })
config({ path: resolve(__dirname, '../.env.local') })
config({ path: resolve(__dirname, '../web/.env.local') })

import { generateListingCopy } from '../lib/ai/pipelines/listing-copy.mjs'

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const listingId = args[0] || process.env.LISTING_ID
const auditId = args[1] || process.env.AUDIT_ID

if (!listingId || !auditId) {
  console.error(`
Usage:
  node scripts/generate-listing-copy.mjs <listing_id> <audit_id>

Or via environment variables:
  LISTING_ID=<id> AUDIT_ID=<id> node scripts/generate-listing-copy.mjs

Both listing_id and audit_id are required UUIDs from your Supabase database.
  `.trim())
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Run pipeline
// ---------------------------------------------------------------------------
console.log('━'.repeat(60))
console.log('VAEL Host — Listing Copy Optimization Pipeline')
console.log('━'.repeat(60))
console.log(`Listing ID : ${listingId}`)
console.log(`Audit ID   : ${auditId}`)
console.log('━'.repeat(60))
console.log()

async function main() {
  const startTime = Date.now()

  try {
    const result = await generateListingCopy(listingId, auditId)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log()
    console.log('━'.repeat(60))
    console.log('✅ SUCCESS')
    console.log('━'.repeat(60))
    console.log(`Deliverable ID : ${result.deliverableId}`)
    console.log(`Elapsed        : ${elapsed}s`)
    console.log()
    console.log('📝 GENERATED TITLE:')
    console.log(`   ${result.content.title}`)
    console.log(`   (${result.content.title.length} characters)`)
    console.log()
    console.log('📄 GENERATED DESCRIPTION:')
    const wordCount = result.content.description.trim().split(/\s+/).length
    console.log(`   [${wordCount} words]`)
    console.log()
    // Print description with word-wrap at ~70 chars
    const words = result.content.description.split(' ')
    let line = '   '
    for (const word of words) {
      if (line.length + word.length > 73) {
        console.log(line)
        line = '   ' + word + ' '
      } else {
        line += word + ' '
      }
    }
    if (line.trim()) console.log(line)
    console.log()
    console.log('✨ GENERATED HIGHLIGHTS:')
    result.content.highlights.forEach((h, i) => {
      console.log(`   ${i + 1}. ${h}`)
    })
    console.log()
    console.log('Deliverable is now in Supabase with status=pending, awaiting owner approval.')
    console.log('━'.repeat(60))
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error()
    console.error('━'.repeat(60))
    console.error('❌ FAILED')
    console.error('━'.repeat(60))
    console.error(`Error    : ${err.message}`)
    console.error(`Elapsed  : ${elapsed}s`)
    console.error()
    console.error('Check Supabase deliverables table for a failed row with error_message.')
    console.error('━'.repeat(60))
    process.exit(1)
  }
}

main()
