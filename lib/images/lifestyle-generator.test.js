/**
 * Unit tests for the lifestyle image generation pipeline.
 * Run with: node --experimental-vm-modules lib/images/lifestyle-generator.test.js
 * Or via Jest if configured.
 *
 * These tests cover the pure logic (season detection, prompt construction)
 * without hitting external APIs.
 */

import { detectCurrentSeason, buildImagePrompts } from './lifestyle-generator.js';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Season detection tests
// ---------------------------------------------------------------------------

function testSeasonDetection() {
  const cases = [
    { month: 11, expected: 'winter', label: 'December' },
    { month: 0,  expected: 'winter', label: 'January' },
    { month: 1,  expected: 'winter', label: 'February' },
    { month: 2,  expected: 'spring', label: 'March' },
    { month: 4,  expected: 'spring', label: 'May' },
    { month: 5,  expected: 'summer', label: 'June' },
    { month: 7,  expected: 'summer', label: 'August' },
    { month: 8,  expected: 'autumn', label: 'September' },
    { month: 10, expected: 'autumn', label: 'November' },
  ];

  for (const { month, expected, label } of cases) {
    // Temporarily mock Date
    const OrigDate = globalThis.Date;
    globalThis.Date = class extends OrigDate {
      getMonth() { return month; }
    };

    const result = detectCurrentSeason();
    assert.equal(result, expected, `Season for ${label} (month ${month}) should be ${expected}, got ${result}`);

    globalThis.Date = OrigDate;
  }
  console.log('✓ Season detection — all cases pass');
}

// ---------------------------------------------------------------------------
// Prompt construction tests
// ---------------------------------------------------------------------------

function testPromptConstruction() {
  const prompts = buildImagePrompts({
    propertyType: 'cabin',
    location: 'Lake Tahoe, CA',
    amenities: ['fireplace', 'hot tub', 'mountain view'],
    season: 'winter',
  });

  assert.equal(prompts.length, 3, 'Should produce exactly 3 prompts');

  const slots = prompts.map((p) => p.slot);
  assert.deepEqual(slots, ['exterior_hero', 'interior_living', 'lifestyle_ambiance'], 'Slot names should match spec');

  for (const { prompt, label } of prompts) {
    assert.ok(prompt.length > 50, `Prompt for ${label} should be substantive`);
    assert.ok(prompt.includes('no people'), `Prompt for ${label} should include "no people"`);
    assert.ok(prompt.includes('professional real estate'), `Prompt for ${label} should include style descriptor`);
    assert.ok(prompt.toLowerCase().includes('winter') || prompt.toLowerCase().includes('snow') || prompt.toLowerCase().includes('fireplace'), `Prompt for ${label} should reference winter season`);
    assert.ok(prompt.includes('Lake Tahoe'), `Prompt for ${label} should include location`);
  }

  console.log('✓ Prompt construction — cabin/winter/Tahoe passes');
}

function testPromptConstructionBeachSummer() {
  const prompts = buildImagePrompts({
    propertyType: 'beach house',
    location: 'Malibu, CA',
    amenities: ['private beach', 'ocean view', 'deck'],
    season: 'summer',
  });

  assert.equal(prompts.length, 3, 'Should produce 3 prompts');

  const exteriorPrompt = prompts.find((p) => p.slot === 'exterior_hero').prompt;
  assert.ok(
    exteriorPrompt.toLowerCase().includes('beach') || exteriorPrompt.toLowerCase().includes('coastal'),
    'Exterior prompt should reference beach/coastal for a beach house'
  );

  console.log('✓ Prompt construction — beach house/summer/Malibu passes');
}

function testPromptConstructionNoAmenities() {
  const prompts = buildImagePrompts({
    propertyType: 'condo',
    location: '',
    amenities: [],
    season: 'spring',
  });

  assert.equal(prompts.length, 3, 'Should produce 3 prompts even with empty amenities');

  for (const { prompt } of prompts) {
    assert.ok(prompt.length > 30, 'Prompt should still be substantive with no amenities');
  }

  console.log('✓ Prompt construction — condo/spring/no location/no amenities passes');
}

function testPromptConstructionUnknownPropertyType() {
  const prompts = buildImagePrompts({
    propertyType: 'yurt',
    location: 'Montana',
    amenities: ['fire pit'],
    season: 'autumn',
  });

  assert.equal(prompts.length, 3, 'Should produce 3 prompts for unknown property types');
  // Should fall back gracefully
  for (const { prompt } of prompts) {
    assert.ok(prompt.includes('Montana'), 'Should still include location');
  }

  console.log('✓ Prompt construction — unknown property type (yurt) falls back gracefully');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

(function runAll() {
  console.log('\n=== lifestyle-generator unit tests ===\n');
  try {
    testSeasonDetection();
    testPromptConstruction();
    testPromptConstructionBeachSummer();
    testPromptConstructionNoAmenities();
    testPromptConstructionUnknownPropertyType();
    console.log('\n✅ All tests passed\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
})();
