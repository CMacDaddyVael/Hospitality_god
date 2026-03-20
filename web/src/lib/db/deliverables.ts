import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export type DeliverableType = 'review_response' | 'social_post' | 'listing_optimization' | 'guest_message';
export type DeliverableStatus = 'pending_approval' | 'approved' | 'rejected' | 'published';

export interface ReviewResponseMetadata {
  sourceReview: string;
  reviewRating: number;
  reviewClassification: 'positive' | 'neutral' | 'negative';
  variant: 'warm' | 'professional';
  voiceProfileApplied: boolean;
  voiceProfileMissing?: boolean;
  wordCount: number;
  generatedAt: string;
}

export interface Deliverable {
  id: string;
  property_id: string;
  type: DeliverableType;
  status: DeliverableStatus;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliverableInput {
  property_id: string;
  type: DeliverableType;
  status: DeliverableStatus;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Insert a single deliverable into the deliverables table
 */
export async function createDeliverable(input: CreateDeliverableInput): Promise<Deliverable> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      property_id: input.property_id,
      type: input.type,
      status: input.status,
      title: input.title,
      content: input.content,
      metadata: input.metadata,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create deliverable: ${error.message}`);
  }

  return data as Deliverable;
}

/**
 * Insert multiple deliverables in a single batch
 */
export async function createDeliverables(inputs: CreateDeliverableInput[]): Promise<Deliverable[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('deliverables')
    .insert(inputs)
    .select();

  if (error) {
    throw new Error(`Failed to create deliverables: ${error.message}`);
  }

  return data as Deliverable[];
}

/**
 * Fetch deliverables for a property, optionally filtered by type
 */
export async function getDeliverables(
  propertyId: string,
  type?: DeliverableType,
  status?: DeliverableStatus
): Promise<Deliverable[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('deliverables')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch deliverables: ${error.message}`);
  }

  return (data || []) as Deliverable[];
}

/**
 * Fetch all pending deliverables across all properties for a user
 */
export async function getPendingDeliverables(userId: string): Promise<Deliverable[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('deliverables')
    .select(`
      *,
      properties!inner(user_id)
    `)
    .eq('properties.user_id', userId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch pending deliverables: ${error.message}`);
  }

  return (data || []) as Deliverable[];
}

/**
 * Update the status of a deliverable (approve/reject)
 */
export async function updateDeliverableStatus(
  id: string,
  status: DeliverableStatus
): Promise<Deliverable> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('deliverables')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update deliverable status: ${error.message}`);
  }

  return data as Deliverable;
}
