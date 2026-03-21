/**
 * Integration tests for the audit results persistence layer.
 * Issue #223 — verifies the acceptance criteria, especially:
 *   "running two audits for the same email produces two rows
 *    retrievable via getAuditHistory"
 *
 * Run with:
 *   node lib/db/audit-results.test.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars pointing at
 * a test / local Supabase instance with the migration already applied.
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — one or more tests failed
 */

import {
  saveAuditResults,
  getLatestAuditByEmail,
  getAuditHistory,
  getAuditById,
} from './audit-results.mjs'

// ---------------------------------------------------------------------------
// Minimal test harness (no external deps)
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Use a unique email per test run so we don't collide with real data
const RUN_ID = Date.now()
const TEST_EMAIL = `test-audit-${RUN_ID}@vael-test.invalid`

const AUDIT_1 = {
  listing_url: 'https://www.airbnb.com/rooms/99999901',
  listing_id: '99999901',
  overall_score: 41,
  scraped_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
  category_scores: [
    { category: 'photos', score: 30 },
    { category: 'title', score: 55 },
    { category: 'description', score: 45 },
  ],
  findings: [
    {
      category: 'photos',
      finding_text: 'No hero shot — first photo is a bathroom',
      severity: 'high',
      recommendation_text: 'Lead with a wide-angle living room or outdoor shot',
    },
    {
      category: 'title',
      finding_text: 'Title contains only 28 characters — Airbnb allows up to 50',
      severity: 'medium',
      recommendation_text: 'Expand title with 2-3 descriptive keywords',
    },
    {
      category: 'description',
      finding_text: 'No mention of nearby attractions',
      severity: 'low',
      recommendation_text: 'Add a paragraph about local highlights within 10 minutes',
    },
  ],
}

const AUDIT_2 = {
  listing_url: 'https://www.airbnb.com/rooms/99999901',
  listing_id: '99999901',
  overall_score: 67,
  scraped_at: new Date().toISOString(),
  category_scores: [
    { category: 'photos', score: 70 },
    { category: 'title', score: 75 },
    { category: 'description', score: 60 },
  ],
  findings: [
    {
      category: 'title',
      finding_text: 'Title still missing a unique selling point',
      severity: 'medium',
      recommendation_text: 'Add a distinguishing feature like "mountain view" or "private pool"',
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\nAudit Results Persistence Layer — Integration Tests\n')
console.log(`Test email: ${TEST_EMAIL}\n`)

// -- Input validation --------------------------------------------------------

await test('saveAuditResults throws when auditOutput is missing', async () => {
  let threw = false
  try {
    await saveAuditResults(null, TEST_EMAIL)
  } catch {
    threw = true
  }
  assert(threw, 'Expected an error to be thrown')
})

await test('saveAuditResults throws when email is missing', async () => {
  let threw = false
  try {
    await saveAuditResults(AUDIT_1, '')
  } catch {
    threw = true
  }
  assert(threw, 'Expected an error to be thrown')
})

await test('saveAuditResults throws when listing_url is missing', async () => {
  let threw = false
  try {
    await saveAuditResults({ overall_score: 50 }, TEST_EMAIL)
  } catch {
    threw = true
  }
  assert(threw, 'Expected an error to be thrown')
})

// -- Happy path write --------------------------------------------------------

let auditId1, auditId2

await test('saveAuditResults saves first audit and returns auditId', async () => {
  const result = await saveAuditResults(AUDIT_1, TEST_EMAIL)
  assert(result && result.auditId, 'Expected auditId in result')
  assert(typeof result.auditId === 'string', 'auditId should be a string (UUID)')
  auditId1 = result.auditId
})

await test('saveAuditResults saves second audit for same email', async () => {
  // Small delay to ensure created_at ordering is deterministic
  await new Promise((r) => setTimeout(r, 50))
  const result = await saveAuditResults(AUDIT_2, TEST_EMAIL)
  assert(result && result.auditId, 'Expected auditId in result')
  assert(result.auditId !== auditId1, 'Second audit should have a different ID')
  auditId2 = result.auditId
})

// -- getLatestAuditByEmail ---------------------------------------------------

await test('getLatestAuditByEmail returns the most recent audit', async () => {
  const result = await getLatestAuditByEmail(TEST_EMAIL)
  assert(result !== null, 'Expected a result, got null')
  assertEqual(result.audit.id, auditId2, 'Should return the second (higher score) audit')
  assertEqual(result.audit.overall_score, 67, 'overall_score should match AUDIT_2')
})

await test('getLatestAuditByEmail includes findings', async () => {
  const result = await getLatestAuditByEmail(TEST_EMAIL)
  assert(Array.isArray(result.findings), 'findings should be an array')
  assertEqual(result.findings.length, 1, 'AUDIT_2 has 1 finding')
  assertEqual(result.findings[0].category, 'title', 'Finding category should be "title"')
  assertEqual(result.findings[0].severity, 'medium', 'Finding severity should be "medium"')
})

await test('getLatestAuditByEmail is case-insensitive on email', async () => {
  const result = await getLatestAuditByEmail(TEST_EMAIL.toUpperCase())
  assert(result !== null, 'Should find audit regardless of email case')
  assertEqual(result.audit.id, auditId2, 'Should return the correct audit')
})

await test('getLatestAuditByEmail returns null for unknown email', async () => {
  const result = await getLatestAuditByEmail('nobody@vael-test.invalid')
  assertEqual(result, null, 'Should return null for unknown email')
})

// -- getAuditHistory — core acceptance criterion -----------------------------

await test('getAuditHistory returns two rows for two audits (core AC)', async () => {
  const history = await getAuditHistory(TEST_EMAIL)
  assert(Array.isArray(history), 'history should be an array')
  assert(
    history.length >= 2,
    `Expected at least 2 history rows, got ${history.length}`
  )
})

await test('getAuditHistory rows contain expected fields', async () => {
  const history = await getAuditHistory(TEST_EMAIL)
  const row = history[0]
  assert('id' in row, 'Row should have id')
  assert('overall_score' in row, 'Row should have overall_score')
  assert('scraped_at' in row, 'Row should have scraped_at')
  assert('created_at' in row, 'Row should have created_at')
  assert('listing_url' in row, 'Row should have listing_url')
})

await test('getAuditHistory returns rows in ascending chronological order', async () => {
  const history = await getAuditHistory(TEST_EMAIL)
  // Filter to just our test audits to avoid interference from other rows
  const ours = history.filter((r) => r.id === auditId1 || r.id === auditId2)
  assert(ours.length === 2, 'Should find both test audits')
  const firstIdx = ours.findIndex((r) => r.id === auditId1)
  const secondIdx = ours.findIndex((r) => r.id === auditId2)
  assert(firstIdx < secondIdx, 'First audit should appear before second in ascending order')
})

await test('getAuditHistory score progression is 41 → 67', async () => {
  const history = await getAuditHistory(TEST_EMAIL)
  const ours = history.filter((r) => r.id === auditId1 || r.id === auditId2)
  assertEqual(ours[0].overall_score, 41, 'First audit score should be 41')
  assertEqual(ours[1].overall_score, 67, 'Second audit score should be 67')
})

await test('getAuditHistory returns empty array for unknown email', async () => {
  const history = await getAuditHistory('nobody@vael-test.invalid')
  assert(Array.isArray(history), 'Should return an array')
  assertEqual(history.length, 0, 'Should be empty for unknown email')
})

// -- getAuditById -----------------------------------------------------------

await test('getAuditById returns correct audit with findings', async () => {
  const result = await getAuditById(auditId1)
  assert(result !== null, 'Expected a result')
  assertEqual(result.audit.id, auditId1, 'Should return the correct audit')
  assertEqual(result.audit.overall_score, 41, 'Score should be 41')
  assertEqual(result.findings.length, 3, 'AUDIT_1 has 3 findings')
})

await test('getAuditById findings are ordered high → medium → low', async () => {
  const result = await getAuditById(auditId1)
  const severities = result.findings.map((f) => f.severity)
  const order = { high: 0, medium: 1, low: 2 }
  for (let i = 0; i < severities.length - 1; i++) {
    assert(
      order[severities[i]] <= order[severities[i + 1]],
      `Severity order wrong at index ${i}: ${severities[i]} before ${severities[i + 1]}`
    )
  }
})

await test('getAuditById returns null for unknown ID', async () => {
  const result = await getAuditById('00000000-0000-0000-0000-000000000000')
  assertEqual(result, null, 'Should return null for unknown audit ID')
})

// -- Audit with no findings --------------------------------------------------

await test('saveAuditResults handles audit with zero findings', async () => {
  const noFindingsAudit = {
    listing_url: 'https://www.airbnb.com/rooms/99999902',
    overall_score: 95,
    scraped_at: new Date().toISOString(),
    findings: [],
  }
  const result = await saveAuditResults(noFindingsAudit, TEST_EMAIL)
  assert(result.auditId, 'Should save successfully even with no findings')

  const retrieved = await getAuditById(result.auditId)
  assertEqual(retrieved.audit.overall_score, 95, 'Score should be 95')
  assertEqual(retrieved.findings.length, 0, 'Should have 0 findings')
})

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.error('\nSome tests failed. Check Supabase connection and migration status.\n')
  process.exit(1)
} else {
  console.log('\nAll tests passed ✓\n')
  process.exit(0)
}
