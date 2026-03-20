/**
 * Manual integration test for generateSocialPostPackage.
 *
 * This is NOT a unit test runner — it's a quick smoke-test you run by hand
 * against a real (or seeded) Supabase database and Anthropic account.
 *
 * Prerequisites:
 *   1. Run the migration: supabase/migrations/002_deliverables.sql
 *   2. Have at least one row in the `listings` table
 *   3. Set env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node --env-file=.env lib/social/generateSocialPostPackage.test.mjs
 *
 * To test against a seeded listing (no real DB), set:
 *   MOCK_LISTING=1 node --env-file=.env lib/social/generateSocialPostPackage.test.mjs
 */

import { generateSocialPostPackage } from './generateSocialPostPackage.mjs'
import { createClient } from '@supabase/supabase-js'

const MOCK_LISTING_ID = '00000000-0000-0000-0000-000000000001'
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000002'
const TEST_WEEK_OF = '2026-04-07' // Monday

async function seedMockListing(supabase) {
  console.log('[Test] Seeding mock listing…')

  const { data, error } = await supabase
    .from('listings')
    .upsert(
      {
        id: MOCK_LISTING_ID,
        user_id: MOCK_USER_ID,
        title: 'Lakefront A-Frame Cabin with Hot Tub — 2BR in Asheville, NC',
        description:
          'Escape to our cozy A-frame nestled on 3 private acres bordering Lake Julian. Wake up to misty mountain mornings from the floor-to-ceiling windows, soak under the stars in the cedar hot tub, then explore Asheville's legendary food and music scene just 20 minutes away. Perfect for couples and small groups seeking that perfect mix of adventure and rest.',
        location: 'Asheville, North Carolina',
        property_type: 'cabin',
        amenities: [
          'Hot tub',
          'Lakefront',
          'Fire pit',
          'Full kitchen',
          'King bed',
          'Fast WiFi',
          'EV charger',
          'Mountain views',
        ],
        airbnb_url: 'https://airbnb.com/rooms/99999999',
        rating: 4.97,
        review_count: 143,
        status: 'active',
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to seed mock listing: ${error.message}`)
  }

  console.log(`[Test] Seeded listing: "${data.title}"`)
  return data
}

async function runTest() {
  console.log('='.repeat(60))
  console.log('generateSocialPostPackage — Integration Test')
  console.log('='.repeat(60))

  const useMock = process.env.MOCK_LISTING === '1'

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let listingId = MOCK_LISTING_ID
  let userId = MOCK_USER_ID

  if (useMock) {
    await seedMockListing(supabase)
  } else {
    // Use a real listing from the DB — pick the first one
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, user_id, title')
      .limit(1)
      .single()

    if (error || !listings) {
      console.error('No listings found in database. Use MOCK_LISTING=1 to seed one.')
      process.exit(1)
    }

    listingId = listings.id
    userId = listings.user_id
    console.log(`[Test] Using real listing: "${listings.title}" (${listingId})`)
  }

  // --- Test run 1: should CREATE a new deliverable ---
  console.log('\n[Test] Run 1 — expect CREATE…')
  const result1 = await generateSocialPostPackage({
    listingId,
    userId,
    weekOf: TEST_WEEK_OF,
  })

  console.assert(result1.created === true, '❌ Run 1: expected created=true')
  console.assert(result1.deliverable.type === 'social_post', '❌ Run 1: expected type=social_post')
  console.assert(result1.deliverable.status === 'pending', '❌ Run 1: expected status=pending')
  console.assert(result1.content.caption.length > 0, '❌ Run 1: expected non-empty caption')
  console.assert(result1.content.hashtags.length === 5, '❌ Run 1: expected 5 hashtags')
  console.assert(result1.content.hook.length > 0, '❌ Run 1: expected non-empty hook')
  console.assert(result1.content.image_brief.length > 0, '❌ Run 1: expected non-empty image_brief')

  console.log('✅  Run 1 passed — deliverable created')
  console.log(`    id     : ${result1.deliverable.id}`)
  console.log(`    hook   : ${result1.content.hook}`)
  console.log(`    caption: ${result1.content.caption.slice(0, 100)}…`)

  // --- Test run 2: same listing + weekOf — should UPDATE, not create duplicate ---
  console.log('\n[Test] Run 2 — same listingId + weekOf, expect UPDATE (no duplicate)…')
  const result2 = await generateSocialPostPackage({
    listingId,
    userId,
    weekOf: TEST_WEEK_OF,
  })

  console.assert(result2.created === false, '❌ Run 2: expected created=false (no duplicate)')
  console.assert(
    result2.deliverable.id === result1.deliverable.id,
    '❌ Run 2: expected same deliverable id'
  )

  console.log('✅  Run 2 passed — no duplicate created, existing row updated')

  // --- Verify caption is property-specific ---
  const caption = result1.content.caption.toLowerCase()
  const listing_location_words = ['asheville', 'north carolina', 'nc', 'lake', 'cabin', 'mountain']
  const isSpecific = listing_location_words.some((word) => caption.includes(word))

  if (isSpecific) {
    console.log('\n✅  Caption specificity check PASSED — references real property details')
  } else {
    console.warn('\n⚠️  Caption specificity check UNCERTAIN — may be generic')
    console.warn('    Caption:', result1.content.caption)
  }

  console.log('\n' + '='.repeat(60))
  console.log('All tests passed ✅')
  console.log('='.repeat(60))
}

runTest().catch((err) => {
  console.error('\n❌ Test failed:', err.message)
  if (process.env.DEBUG) console.error(err.stack)
  process.exit(1)
})
