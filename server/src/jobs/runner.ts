import { STEPS } from '../pipeline/index.js';
import { updateJob } from './repo.js';
import jobEvents from './events.js';

const inFlight = new Set<string>();

async function runJob(jobId: string): Promise<void> {
  // DB write first — emit only after confirmed persisted
  updateJob(jobId, { status: 'processing', progress: 0 });
  jobEvents.emit('status', { jobId, status: 'processing' });
  jobEvents.emit('progress', { jobId, progress: 0 });

  for (let i = 0; i < STEPS.length; i++) {
    await STEPS[i].run({ jobId });
    const progress = Math.round(((i + 1) / STEPS.length) * 100);
    updateJob(jobId, { progress });
    jobEvents.emit('progress', { jobId, progress });
  }

  const result = { message: 'Your plan is ready', rating: 5 };

  // Guard for empty STEPS: ensure progress reaches 100 before done
  if (STEPS.length === 0) {
    updateJob(jobId, { progress: 100 });
    jobEvents.emit('progress', { jobId, progress: 100 });
  }

  updateJob(jobId, { status: 'done', result });
  jobEvents.emit('status', { jobId, status: 'done' });
  jobEvents.emit('done', { jobId, result });
}

export function enqueueJob(jobId: string): void {
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);

  void runJob(jobId)
    .catch(err => {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Job ${jobId} failed:`, err);
      // Persist error message in result so GET /jobs/:id reflects the failure reason
      try {
        updateJob(jobId, { status: 'failed', result: { error } });
      } catch (updateErr) {
        console.error(`Failed to mark job ${jobId} as failed:`, updateErr);
      }
      // Always emit failure events so connected WS clients are notified
      jobEvents.emit('status', { jobId, status: 'failed' });
      jobEvents.emit('failed', { jobId, error });
    })
    .finally(() => {
      inFlight.delete(jobId);
    });
}
