/**
 * Agent Task Queue — Type Definitions
 * All autonomous agent actions flow through this system.
 */

export type TaskType =
  | 'listing_analysis'
  | 'review_response'
  | 'guest_message'
  | 'social_post'
  | 'health_score';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface AgentTask {
  id: string;
  property_id: string;
  task_type: TaskType;
  status: TaskStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  scheduled_for: string;
  attempted_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  property_id: string;
  task_type: TaskType;
  payload?: Record<string, unknown>;
  scheduled_for?: Date;
}

export interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface WorkerContext {
  task: AgentTask;
  attempt: number;
}
