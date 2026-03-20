#!/usr/bin/env node
/**
 * Manual trigger script for the social post generation pipeline.
 *
 * Usage:
 *   node scripts/run-social-post.mjs --listingId <uuid> --userId <uuid> [--weekOf 2026-04-07]
 *
 * Or with environment variables:
 *   LISTING_ID=xxx USER_ID=yyy node scripts/run-social-post.mjs
 *
 * For local dev with a .env file:
 *   node --env-file=.env scripts/run-social-post.mjs --listingId xxx --userId yyy
 *
 * Prerequisites:
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must be set.
 */

import { generateSocialPostPackage } from '../lib/social/generateSocialPostPackage.mjs'

// ---------------------------------------------------------------------------
// Arg parsing (minimal — no external deps)
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true'
      result[key] = value
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs()

  const listingId = args.listingId || process.env.LISTING_ID
  const userId = args.userId || process.env.USER_ID
  const weekOf = args.weekOf || process.env.WEEK_OF || undefined

  if (!listingId || !userId) {
    console.error(`
ERROR: listingId and userId are required.

Usage:
  node scripts/run-social-post.mjs --listingId <uuid> --userId <uuid> [--weekOf 2026-04-07]

Or set env vars:
  LISTING_ID=<uuid> USER_ID=<uuid> node scripts/run-social-post.mjs
`)
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('VAEL Host — Social Post Package Generator')
  console.log('='.repeat(60))
  console.log(`Listing ID : ${listingId}`)
  console.log(`User ID    : ${userId}`)
  console.log(`Week of    : ${weekOf || '(current week)'}`)
  console.log('='.repeat(60))
  console.log()

  try {
    const result = await generateSocialPostPackage({ listingId, userId, weekOf })

    const { content, created, deliverable } = result

    console.log()
    console.log('='.repeat(60))
    console.log(`✅  Deliverable ${created ? 'CREATED' : 'UPDATED'} — id: ${deliverable.id}`)
    console.log('='.repeat(60))
    console.log()
    console.log('📌  HOOK (first-frame text)')
    console.log(`    ${content.hook}`)
    console.log()
    console.log('📝  CAPTION')
    console.log('    ' + content.caption.split('\n').join('\n    '))
    console.log()
    console.log('🏷️  HASHTAGS')
    console.log('    ' + content.hashtags.join('  '))
    console.log()
    console.log('🖼️  IMAGE BRIEF')
    console.log('    ' + content.image_brief.split('\n').join('\n    '))
    console.log()
    console.log('='.repeat(60))
    console.log('Done.')
  } catch (err) {
    console.error()
    console.error('❌  Pipeline failed:')
    console.error(err.message)
    if (process.env.DEBUG) console.error(err.stack)
    process.exit(1)
  }
}

main()
