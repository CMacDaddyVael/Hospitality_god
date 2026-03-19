/**
 * Agent Task Queue — Public API
 *
 * All feature modules use these functions to interact with the queue.
 * Direct writes to agent_tasks are forbidden outside this module.
 *
 * Usage:
 *   import { enqueueTask, getActivityFeed } from '@/lib/queue';
 *   await enqueueTask({ property_id, task_type: 'social_post', payload: { ... } });
 */

import { getSupabaseClient } from './client';
import type { AgentTask, CreateTaskInput, TaskStatus, TaskResult } from './types';

export type { AgentTask, CreateTaskInput, TaskStatus, TaskResult };
export { TASK_TYPES, MAX_RETRY_COUNT, MAX_CONCURRENT_PER_PROPERTY } from './constants';

import { MAX_RETRY_COUNT, MAX_CONCURRENT_PER_PROPERTY, RETRY_BACKOFF_MINUTES } from './constants';

// ─── Task Creation ─────────────────────────────────────────────────────────────

/**
 * Enqueue a new task. The only way feature modules create tasks.
 */
export async function enqueueTask(input: CreateTaskInput): Promise<AgentTask> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      property_id: input.property_id,
      task_type: input.task_type,
      payload: input.payload ?? {},
      scheduled_for: (input.scheduled_for ?? new Date()).toISOString(),
      status: 'pending',
      retry_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to enqueue task: ${error.message}`);
  return data as AgentTask;
}

/**
 * Enqueue multiple tasks in a single round-trip.
 */
export async function enqueueTasks(inputs: CreateTaskInput[]): Promise<AgentTask[]> {
  if (inputs.length === 0) return [];

  const supabase = getSupabaseClient();

  const rows = inputs.map((input) => ({
    property_id: input.property_id,
    task_type: input.task_type,
    payload: input.payload ?? {},
    scheduled_for: (input.scheduled_for ?? new Date()).toISOString(),
    status: 'pending',
    retry_count: 0,
  }));

  const { data, error } = await supabase
    .from('agent_tasks')
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to enqueue tasks: ${error.message}`);
  return data as AgentTask[];
}

// ─── Dispatcher Queries ────────────────────────────────────────────────────────

/**
 * Fetch pending tasks ready to execute.
 * Called by the cron dispatcher every 5 minutes.
 *
 * Respects:
 *   - scheduled_for <= now()
 *   - retry_count < MAX_RETRY_COUNT
 *   - MAX_CONCURRENT_PER_PROPERTY running tasks per property
 */
export async function fetchPendingTasks(limit = 50): Promise<AgentTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', MAX_RETRY_COUNT)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch pending tasks: ${error.message}`);
  return (data ?? []) as AgentTask[];
}

/**
 * Count running tasks per property to enforce concurrency limits.
 */
export async function getRunningCountByProperty(
  propertyIds: string[]
): Promise<Record<string, number>> {
  if (propertyIds.length === 0) return {};

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('property_id')
    .eq('status', 'running')
    .in('property_id', propertyIds);

  if (error) throw new Error(`Failed to get running counts: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.property_id] = (counts[row.property_id] ?? 0) + 1;
  }
  return counts;
}

// ─── Task Status Updates ───────────────────────────────────────────────────────

/**
 * Mark a task as running. Called at the start of worker execution.
 */
export async function markTaskRunning(taskId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'running',
      attempted_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to mark task running: ${error.message}`);
}

/**
 * Mark a task as completed with an optional result payload.
 */
export async function markTaskCompleted(
  taskId: string,
  result?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: result ?? null,
      error_message: null,
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to mark task completed: ${error.message}`);
}

/**
 * Mark a task as failed.
 * If retry_count < MAX_RETRY_COUNT, resets to pending with backoff.
 * If retry_count >= MAX_RETRY_COUNT, marks permanently failed.
 */
export async function markTaskFailed(
  taskId: string,
  errorMessage: string,
  currentRetryCount: number
): Promise<void> {
  const supabase = getSupabaseClient();

  const newRetryCount = currentRetryCount + 1;
  const isPermanentlyFailed = newRetryCount >= MAX_RETRY_COUNT;

  const backoffMinutes = RETRY_BACKOFF_MINUTES * newRetryCount;
  const nextScheduled = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('agent_tasks')
    .update({
      status: isPermanentlyFailed ? 'failed' : 'pending',
      retry_count: newRetryCount,
      error_message: errorMessage,
      scheduled_for: isPermanentlyFailed ? undefined : nextScheduled,
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to mark task failed: ${error.message}`);
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

/**
 * Get activity feed for a property's dashboard.
 * Includes completed, failed, and running tasks with human-readable errors.
 */
export async function getActivityFeed(
  propertyId: string,
  limit = 20
): Promise<AgentTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_task_activity')
    .select('*')
    .eq('property_id', propertyId)
    .limit(limit);

  if (error) throw new Error(`Failed to get activity feed: ${error.message}`);
  return (data ?? []) as AgentTask[];
}

/**
 * Get permanently failed tasks (retry_count >= MAX_RETRY_COUNT) for a property.
 * Used to surface actionable errors in the dashboard.
 */
export async function getFailedTasks(propertyId: string): Promise<AgentTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'failed')
    .gte('retry_count', MAX_RETRY_COUNT)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Failed to get failed tasks: ${error.message}`);
  return (data ?? []) as AgentTask[];
}

/**
 * Get a single task by ID.
 */
export async function getTask(taskId: string): Promise<AgentTask | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get task: ${error.message}`);
  }

  return data as AgentTask;
}
