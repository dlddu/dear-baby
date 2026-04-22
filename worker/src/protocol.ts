// Envelope is the on-the-wire format the backend enqueues. Keep this
// aligned with backend/internal/tasks/client.go — changing it here
// without touching the backend will silently drop jobs.

export interface Envelope {
  type: string;
  job_id: string;
  issued_at: string;
  v: number;
  payload: unknown;
}

export const QUEUE_KEY = 'tasks:queue';

export function resultChannel(taskType: string, userId: string): string {
  return `tasks:result:${taskType}:${userId}`;
}
