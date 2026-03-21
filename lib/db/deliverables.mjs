/**
 * lib/db/deliverables.mjs
 *
 * Universal deliverable writer/reader for all VAEL content agents.
 * Issue #225 — central plumbing that connects agents → dashboard → weekly brief.
 *
 * Every content agent (listing optimizer, review responder, social content,
 * competitive intel, seasonal updater) calls saveDeliverable() to persist its
 * output. The approval UI and weekly brief query getPendingDeliverables().
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DELIVERABLE_TYPES = /** @type {const} */ ([
  'listing_copy',
  'review_response',
  'social_post',
  'competitive_report',
  'seasonal_update',
]);

export const DELIVERABLE_STATUSES = /** @type {const} */ ([
  'pending_review',
  'approved',
  'used',
  'dismissed',
]);

// ---------------------------------------------------------------------------
// Supabase client (service role — agents run server-side)
// ---------------------------------------------------------------------------

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[deliverables] Missing Supabase credentials. ' +
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} type
 */
function assertValidType(type) {
  if (!DELIVERABLE_TYPES.includes(type)) {
    throw new Error(
      `[deliverables] Invalid type "${type}". ` +
        `Must be one of: ${DELIVERABLE_TYPES.join(', ')}`
    );
  }
}

/**
 * @param {string} status
 */
function assertValidStatus(status) {
  if (!DELIVERABLE_STATUSES.includes(status)) {
    throw new Error(
      `[deliverables] Invalid status "${status}". ` +
        `Must be one of: ${DELIVERABLE_STATUSES.join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a new deliverable produced by any content agent.
 *
 * @param {{
 *   subscriberId: string,
 *   listingId?: string | null,
 *   type: 'listing_copy' | 'review_response' | 'social_post' | 'competitive_report' | 'seasonal_update',
 *   title: string,
 *   contentJson: Record<string, unknown>,
 *   agentVersion?: string,
 * }} params
 *
 * @returns {Promise<string>} The UUID of the newly created deliverable row.
 */
export async function saveDeliverable({
  subscriberId,
  listingId = null,
  type,
  title,
  contentJson,
  agentVersion = '1.0.0',
}) {
  if (!subscriberId) throw new Error('[deliverables] subscriberId is required');
  if (!title?.trim()) throw new Error('[deliverables] title is required');
  if (!contentJson || typeof contentJson !== 'object') {
    throw new Error('[deliverables] contentJson must be a non-null object');
  }

  assertValidType(type);

  const supabase = getClient();

  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      subscriber_id: subscriberId,
      listing_id: listingId ?? null,
      type,
      title: title.trim(),
      content_json: contentJson,
      status: 'pending_review',
      agent_version: agentVersion,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `[deliverables] Failed to save deliverable: ${error.message} (code: ${error.code})`
    );
  }

  return data.id;
}

/**
 * Fetch all pending-review deliverables for a subscriber, newest first.
 * Used by the approval dashboard and weekly brief builder.
 *
 * @param {string} subscriberId
 * @returns {Promise<Array<{
 *   id: string,
 *   subscriber_id: string,
 *   listing_id: string | null,
 *   type: string,
 *   title: string,
 *   content_json: Record<string, unknown>,
 *   status: string,
 *   agent_version: string,
 *   created_at: string,
 *   reviewed_at: string | null,
 * }>>}
 */
export async function getPendingDeliverables(subscriberId) {
  if (!subscriberId) throw new Error('[deliverables] subscriberId is required');

  const supabase = getClient();

  const { data, error } = await supabase
    .from('deliverables')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      `[deliverables] Failed to fetch pending deliverables: ${error.message}`
    );
  }

  return data ?? [];
}

/**
 * Update the status of a single deliverable.
 * Called by the approval UI when an owner approves, dismisses, or marks used.
 *
 * @param {string} id  - UUID of the deliverable row
 * @param {'pending_review' | 'approved' | 'used' | 'dismissed'} status
 * @returns {Promise<void>}
 */
export async function updateDeliverableStatus(id, status) {
  if (!id) throw new Error('[deliverables] id is required');

  assertValidStatus(status);

  const supabase = getClient();

  const updatePayload = {
    status,
    // Set reviewed_at whenever the owner takes any action that isn't re-opening
    ...(status !== 'pending_review' ? { reviewed_at: new Date().toISOString() } : {}),
  };

  const { error } = await supabase
    .from('deliverables')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    throw new Error(
      `[deliverables] Failed to update deliverable status: ${error.message}`
    );
  }
}

/**
 * Fetch a single deliverable by ID.
 * Useful for agents that need to check if a deliverable already exists.
 *
 * @param {string} id
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getDeliverableById(id) {
  if (!id) throw new Error('[deliverables] id is required');

  const supabase = getClient();

  const { data, error } = await supabase
    .from('deliverables')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(
      `[deliverables] Failed to fetch deliverable: ${error.message}`
    );
  }

  return data;
}

/**
 * Fetch all deliverables for a subscriber (all statuses), newest first.
 * Used by the full deliverables history view.
 *
 * @param {string} subscriberId
 * @param {{ type?: string, limit?: number }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getAllDeliverables(subscriberId, { type, limit = 100 } = {}) {
  if (!subscriberId) throw new Error('[deliverables] subscriberId is required');

  const supabase = getClient();

  let query = supabase
    .from('deliverables')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    assertValidType(type);
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `[deliverables] Failed to fetch deliverables: ${error.message}`
    );
  }

  return data ?? [];
}
