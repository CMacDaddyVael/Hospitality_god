/**
 * Agent Task Executor
 *
 * Runs a single task through its worker function with:
 * - Running state management
 * - Error catching and retry logic
 * - Structured logging
 *
 * Called by the cron dispatcher for each pending task.
 */

import {
  markTaskRunning,
  markTaskCompleted,
  markTaskFailed,
} from './index';
import { WORKERS } from './workers';
import type { AgentTask, TaskResult } from './types';

/**
 * Execute a single task. Handles all state transitions.
 * Safe to call in parallel — state is managed per task ID.
 */
export async function executeTask(task: AgentTask): Promise<TaskResult> {
  const worker = WORKERS[task.task_type];

  if (!worker) {
    const error = `No worker registered for task type: ${task.task_type}`;
    console.error(`[executor] ${error} (task=${task.id})`);
    await markTaskFailed(task.id, error, task.retry_count);
    return { success: false, error };
  }

  // Mark as running
  try {
    await markTaskRunning(task.id);
  } catch (err) {
    // If we can't mark it running, abort — another dispatcher may have picked it up
    console.error(`[executor] Failed to mark task running (task=${task.id}):`, err);
    return { success: false, error: 'Failed to claim task' };
  }

  console.log(
    `[executor] Starting ${task.task_type} (task=${task.id}, property=${task.property_id}, attempt=${task.retry_count + 1})`
  );

  // Execute worker
  let result: TaskResult;
  try {
    result = await worker({
      task,
      attempt: task.retry_count + 1,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[executor] Worker threw exception (task=${task.id}):`, errorMessage);

    await markTaskFailed(task.id, errorMessage, task.retry_count);
    return { success: false, error: errorMessage };
  }

  // Handle worker result
  if (result.success) {
    await markTaskCompleted(task.id, result.data);
    console.log(`[executor] Completed ${task.task_type} (task=${task.id})`);
  } else {
    const errorMessage = result.error ?? 'Worker returned failure without message';
    console.error(`[executor] Worker failed (task=${task.id}): ${errorMessage}`);
    await markTaskFailed(task.id, errorMessage, task.retry_count);
  }

  return result;
}
