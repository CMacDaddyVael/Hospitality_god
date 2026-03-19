/**
 * Re-calibration Tracker
 * 
 * Tracks how many times an owner has manually edited AI-drafted content.
 * When they hit the RECALIBRATION_EDIT_THRESHOLD (5 edits), trigger re-calibration.
 * 
 * In production, edit counts are stored in the `properties` table.
 * This module provides the logic layer.
 */

import { RECALIBRATION_EDIT_THRESHOLD } from "./index.mjs";

/**
 * Increment the edit counter for a property and check if recalibration is needed.
 * 
 * @param {object} supabaseClient - Supabase client
 * @param {string} propertyId
 * @returns {Promise<{ editCount: number, shouldRecalibrate: boolean }>}
 */
export async function recordAiDraftEdit(supabaseClient, propertyId) {
  try {
    // Fetch current count
    const { data: property, error: fetchError } = await supabaseClient
      .from("properties")
      .select("ai_draft_edit_count, voice_profile")
      .eq("id", propertyId)
      .single();

    if (fetchError) throw fetchError;

    const currentCount = property?.ai_draft_edit_count ?? 0;
    const newCount = currentCount + 1;
    const triggerRecalibration = newCount >= RECALIBRATION_EDIT_THRESHOLD;

    // Update the count (and reset if recalibration triggered)
    const updatePayload = {
      ai_draft_edit_count: triggerRecalibration ? 0 : newCount,
      updated_at: new Date().toISOString(),
    };

    if (triggerRecalibration) {
      updatePayload.recalibration_needed = true;
    }

    const { error: updateError } = await supabaseClient
      .from("properties")
      .update(updatePayload)
      .eq("id", propertyId);

    if (updateError) throw updateError;

    return {
      editCount: newCount,
      shouldRecalibrate: triggerRecalibration,
      previousCount: currentCount,
    };
  } catch (err) {
    console.error("[RecalibrationTracker] Failed to record edit:", err.message);
    return { editCount: 0, shouldRecalibrate: false, error: err.message };
  }
}

/**
 * Mark recalibration as complete for a property.
 * 
 * @param {object} supabaseClient
 * @param {string} propertyId
 * @param {object} newVoiceProfile
 */
export async function markRecalibrationComplete(supabaseClient, propertyId, newVoiceProfile) {
  const { error } = await supabaseClient
    .from("properties")
    .update({
      voice_profile: newVoiceProfile,
      recalibration_needed: false,
      ai_draft_edit_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId);

  if (error) {
    throw new Error(`Failed to mark recalibration complete: ${error.message}`);
  }
}

/**
 * Check if a property needs recalibration.
 * 
 * @param {object} supabaseClient
 * @param {string} propertyId
 * @returns {Promise<boolean>}
 */
export async function checkRecalibrationNeeded(supabaseClient, propertyId) {
  try {
    const { data, error } = await supabaseClient
      .from("properties")
      .select("recalibration_needed, ai_draft_edit_count")
      .eq("id", propertyId)
      .single();

    if (error) return false;

    return data?.recalibration_needed === true ||
      (data?.ai_draft_edit_count ?? 0) >= RECALIBRATION_EDIT_THRESHOLD;
  } catch {
    return false;
  }
}
