import type { Job } from './types';

const BASE = import.meta.env.VITE_API_BASE_URL;

export async function createJob(): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/jobs`, { method: 'POST' });
  if (!res.ok) throw new Error(`createJob failed: ${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

export async function getJob(id: string, signal?: AbortSignal): Promise<Job> {
  const res = await fetch(`${BASE}/jobs/${id}`, { signal });
  if (!res.ok) throw new Error(`getJob failed: ${res.status}`);
  return res.json() as Promise<Job>;
}

export async function* pollJob(
  id: string,
  { intervalMs = 1000, signal }: { intervalMs?: number; signal?: AbortSignal } = {},
): AsyncGenerator<Job> {
  while (!signal?.aborted) {
    let job: Job;
    try {
      job = await getJob(id, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
    yield job;
    if (job.status === 'done' || job.status === 'failed') return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, intervalMs);
      signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}
