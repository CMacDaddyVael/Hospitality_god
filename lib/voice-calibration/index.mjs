/**
 * Voice Calibration — Main Entry Point
 * 
 * Orchestrates the full calibration flow:
 * 1. Pull existing review responses for a property
 * 2. If <3 responses exist, signal that sample collection is needed
 * 3. Run Claude extraction on available samples
 * 4. Store the voice profile in the database
 * 5. Expose re-calibration logic
 */

import { extractVoiceProfile, DEFAULT_VOICE_PROFILE } from "./extract.mjs";
import { getCalibrationPrompts } from "./dummy-reviews.mjs";

export { extractVoiceProfile, buildVoiceInstruction } from "./extract.mjs";
export { getCalibrationPrompts, DUMMY_REVIEWS } from "./dummy-reviews.mjs";
export { DEFAULT_VOICE_PROFILE } from "./extract.mjs";

export const MIN_SAMPLES_REQUIRED = 3;
export const RECALIBRATION_EDIT_THRESHOLD = 5;

/**
 * Determine calibration status for a property.
 * 
 * @param {string[]} existingResponses - Owner's past written responses
 * @returns {{ needsMoreSamples: boolean, sampleCount: number, canCalibrate: boolean }}
 */
export function getCalibrationStatus(existingResponses) {
  const count = existingResponses ? existingResponses.length : 0;
  return {
    needsMoreSamples: count < MIN_SAMPLES_REQUIRED,
    sampleCount: count,
    canCalibrate: count >= MIN_SAMPLES_REQUIRED,
    promptsNeeded: Math.max(0, MIN_SAMPLES_REQUIRED - count),
  };
}

/**
 * Run the full calibration pipeline for a property.
 * 
 * @param {object} params
 * @param {string[]} params.existingSamples - Already collected writing samples
 * @param {string[]} [params.manualSamples] - Manually provided samples from onboarding UI
 * @param {string} [params.propertyName]
 * @param {string} [params.ownerName]
 * @returns {Promise<object>} The generated voice profile
 */
export async function runCalibration({
  existingSamples = [],
  manualSamples = [],
  propertyName,
  ownerName,
}) {
  const allSamples = [...existingSamples, ...manualSamples].filter(
    (s) => typeof s === "string" && s.trim().length > 10
  );

  console.log(
    `[VoiceCalibration] Running calibration with ${allSamples.length} samples ` +
      `(${existingSamples.length} existing + ${manualSamples.length} manual)`
  );

  const profile = await extractVoiceProfile(allSamples, {
    propertyName,
    ownerName,
  });

  return profile;
}

/**
 * Check whether re-calibration should be triggered.
 * Re-calibration is triggered when an owner has manually edited
 * RECALIBRATION_EDIT_THRESHOLD or more AI-drafted responses.
 * 
 * @param {number} editCount - Number of AI drafts the owner has edited
 * @returns {boolean}
 */
export function shouldRecalibrate(editCount) {
  return editCount >= RECALIBRATION_EDIT_THRESHOLD;
}
