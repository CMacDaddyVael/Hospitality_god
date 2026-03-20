/**
 * Basic unit tests for the VAEL image generation prompt builder.
 * Image generation itself is integration-tested manually.
 */

import { buildImagePrompt } from './vael'

describe('buildImagePrompt', () => {
  it('includes property type and location', () => {
    const prompt = buildImagePrompt({
      propertyType: 'beach cottage',
      location: 'Malibu, California',
    })
    expect(prompt).toContain('beach cottage')
    expect(prompt).toContain('Malibu, California')
  })

  it('includes scenic amenities when present', () => {
    const prompt = buildImagePrompt({
      propertyType: 'cabin',
      location: 'Lake Tahoe',
      amenities: ['hot tub', 'fireplace', 'WiFi', 'parking'],
    })
    expect(prompt).toContain('hot tub')
    expect(prompt).toContain('fireplace')
    // Non-scenic amenities should be excluded
    expect(prompt).not.toContain('WiFi')
  })

  it('limits scenic amenities to 2', () => {
    const prompt = buildImagePrompt({
      amenities: ['pool', 'hot tub', 'ocean view', 'mountain view'],
    })
    // Should include at most 2 of these
    const matches = ['pool', 'hot tub', 'ocean view', 'mountain view'].filter((a) =>
      prompt.includes(a)
    )
    expect(matches.length).toBeLessThanOrEqual(2)
  })

  it('falls back gracefully when no context provided', () => {
    const prompt = buildImagePrompt({})
    expect(prompt).toContain('vacation rental')
    expect(prompt).toContain('a scenic destination')
    expect(prompt.length).toBeGreaterThan(50)
  })

  it('always excludes people', () => {
    const prompt = buildImagePrompt({ propertyType: 'villa', location: 'Tuscany' })
    expect(prompt).toContain('No people')
  })

  it('uses post-type hint', () => {
    const interior = buildImagePrompt({ propertyType: 'loft' }, 'interior')
    const exterior = buildImagePrompt({ propertyType: 'loft' }, 'exterior')
    expect(interior).toContain('interior')
    expect(exterior).toContain('exterior')
  })
})
