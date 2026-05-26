import { nanoid } from 'nanoid';
import db from '../db/client.js';
import type { Job, JobStatus } from './types.js';

const VALID_STATUSES = new Set<string>(['queued', 'processing', 'done', 'failed']);

const insertStmt = db.prepare<[string, JobStatus, number]>(
  'INSERT INTO jobs (id, status, progress, createdAt) VALUES (?, ?, 0, ?)'
);

const selectStmt = db.prepare<[string], { id: string; status: string; progress: number; result: string | null; createdAt: number }>(
  'SELECT id, status, progress, result, createdAt FROM jobs WHERE id = ?'
);

const updateStmt = db.prepare<[JobStatus | null, number | null, string | null, string]>(
  'UPDATE jobs SET status = COALESCE(?, status), progress = COALESCE(?, progress), result = COALESCE(?, result) WHERE id = ?'
);

export function createJob(): Job {
  const id = nanoid();
  const createdAt = Date.now();
  insertStmt.run(id, 'queued', createdAt);
  return { id, status: 'queued', progress: 0, result: null, createdAt };
}

export function getJob(id: string): Job | null {
  const row = selectStmt.get(id);
  if (!row) return null;
  if (!VALID_STATUSES.has(row.status)) {
    throw new Error(`Job ${id} has invalid status "${row.status}" in database`);
  }
  return {
    ...row,
    status: row.status as JobStatus,
    result: row.result !== null ? JSON.parse(row.result) as unknown : null,
  };
}

export function updateJob(
  id: string,
  patch: Partial<Pick<Job, 'status' | 'progress'> & { result: NonNullable<unknown> }>
): Job {
  const status = patch.status ?? null;
  const progress = patch.progress ?? null;
  const result = patch.result !== undefined ? JSON.stringify(patch.result) : null;

  const { changes } = updateStmt.run(status, progress, result, id);
  if (changes === 0) throw new Error(`Job ${id} not found`);

  const updated = getJob(id);
  if (!updated) throw new Error(`Job ${id} not found after update`);
  return updated;
}
