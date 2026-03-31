/**
 * Unit tests for subscriber activation logic.
 *
 * Run with: npx jest web/src/lib/subscriber/__tests__/activate.test.ts
 *
 * These tests validate the core business logic without hitting real Supabase/Stripe.
 */

import { validateActivationPayload, buildJobsFromPreferences } from '../activation'

describe('validateActivationPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateActivationPayload({
      subscriber_id: 'user-123',
      preferences: {
        modules: ['social', 'listing_optimization'],
        properties: ['https://airbnb.com/rooms/12345'],
      },
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing subscriber_id', () => {
    const result = validateActivationPayload({
      subscriber_id: '',
      preferences: {
        modules: ['social'],
        properties: ['https://airbnb.com/rooms/12345'],
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('subscriber_id is required')
  })

  it('rejects empty modules array', () => {
    const result = validateActivationPayload({
      subscriber_id: 'user-123',
      preferences: {
        modules: [],
        properties: ['https://airbnb.com/rooms/12345'],
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('modules'))).toBe(true)
  })

  it('rejects invalid module names', () => {
    const result = validateActivationPayload({
      subscriber_id: 'user-123',
      preferences: {
        modules: ['social', 'invalid_module'],
        properties: ['https://airbnb.com/rooms/12345'],
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('invalid_module'))).toBe(true)
  })

  it('rejects invalid property URLs', () => {
    const result = validateActivationPayload({
      subscriber_id: 'user-123',
      preferences: {
        modules: ['social'],
        properties: ['not-a-url'],
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('not-a-url'))).toBe(true)
  })
})

describe('buildJobsFromPreferences', () => {
  const now = new Date('2026-01-01T00:00:00Z').toISOString()

  it('creates one job per module × property', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social', 'review_responses'],
      propertyUrls: ['https://airbnb.com/rooms/111', 'https://airbnb.com/rooms/222'],
      now,
    })
    // 2 modules × 2 properties = 4 jobs
    expect(jobs).toHaveLength(4)
  })

  it('sets trigger to immediate_activation', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
    })
    expect(jobs[0].trigger).toBe('immediate_activation')
  })

  it('sets cadence to weekly', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
    })
    expect(jobs[0].cadence).toBe('weekly')
  })

  it('sets status to pending', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
    })
    expect(jobs[0].status).toBe('pending')
  })

  it('sets scheduled_for to now (immediate)', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
    })
    expect(jobs[0].scheduled_for).toBe(now)
  })

  it('skips modules in alreadyEnqueued set', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social', 'review_responses'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
      alreadyEnqueuedModules: new Set(['social']),
    })
    // social skipped, only review_responses
    expect(jobs).toHaveLength(1)
    expect(jobs[0].module).toBe('review_responses')
  })

  it('returns empty array when all modules already enqueued', () => {
    const jobs = buildJobsFromPreferences({
      subscriberId: 'user-123',
      modules: ['social'],
      propertyUrls: ['https://airbnb.com/rooms/111'],
      now,
      alreadyEnqueuedModules: new Set(['social']),
    })
    expect(jobs).toHaveLength(0)
  })
})
