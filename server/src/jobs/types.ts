export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  result: unknown | null;
  createdAt: number;
}

export type WsClientMessage = { type: 'subscribe'; jobId: string };

export type WsServerMessage =
  | { type: 'snapshot'; job: Job }
  | { type: 'status'; jobId: string; status: JobStatus }
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'done'; jobId: string; result: unknown }
  | { type: 'failed'; jobId: string; error: string }
  | { type: 'error'; message: string };
