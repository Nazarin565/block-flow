import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { getJob } from '../jobs/repo.js';
import jobEvents from '../jobs/events.js';
import type { WsClientMessage, WsServerMessage, JobStatus } from '../jobs/types.js';

function send(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachWsServer(httpServer: Server<typeof IncomingMessage>): void {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    let subscribedJobId: string | null = null;
    let closing = false;

    const onStatus = ({ jobId, status }: { jobId: string; status: JobStatus }) => {
      if (jobId !== subscribedJobId) return;
      send(ws, { type: 'status', jobId, status });
    };

    const onProgress = ({ jobId, progress }: { jobId: string; progress: number }) => {
      if (jobId !== subscribedJobId) return;
      send(ws, { type: 'progress', jobId, progress });
    };

    const onDone = ({ jobId, result }: { jobId: string; result: unknown }) => {
      if (jobId !== subscribedJobId) return;
      removeListeners();
      send(ws, { type: 'done', jobId, result });
      ws.close();
    };

    const onFailed = ({ jobId, error }: { jobId: string; error: string }) => {
      if (jobId !== subscribedJobId) return;
      removeListeners();
      send(ws, { type: 'failed', jobId, error });
      ws.close();
    };

    function removeListeners(): void {
      jobEvents.off('status', onStatus);
      jobEvents.off('progress', onProgress);
      jobEvents.off('done', onDone);
      jobEvents.off('failed', onFailed);
    }

    ws.on('message', (raw) => {
      if (closing) return;

      let msg: WsClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as WsClientMessage;
      } catch {
        send(ws, { type: 'error', message: 'invalid_message' });
        return;
      }

      if (msg.type !== 'subscribe' || typeof msg.jobId !== 'string') {
        send(ws, { type: 'error', message: 'invalid_message' });
        return;
      }

      if (subscribedJobId !== null) return; // one subscription per connection

      let job;
      try {
        job = getJob(msg.jobId);
      } catch (err) {
        send(ws, { type: 'error', message: 'internal_error' });
        closing = true;
        ws.close();
        return;
      }

      if (!job) {
        closing = true;
        send(ws, { type: 'error', message: 'job_not_found' });
        ws.close();
        return;
      }

      // Register listeners BEFORE sending snapshot to avoid the race where
      // the job finishes between getJob() and listener registration
      subscribedJobId = msg.jobId;
      jobEvents.on('status', onStatus);
      jobEvents.on('progress', onProgress);
      jobEvents.on('done', onDone);
      jobEvents.on('failed', onFailed);

      send(ws, { type: 'snapshot', job });

      // Job already finished — send terminal frame and clean up immediately
      if (job.status === 'done') {
        removeListeners();
        send(ws, { type: 'done', jobId: job.id, result: job.result });
        ws.close();
        return;
      }
      if (job.status === 'failed') {
        removeListeners();
        const error = typeof job.result === 'object' && job.result !== null && 'error' in job.result
          ? String((job.result as Record<string, unknown>).error)
          : 'unknown error';
        send(ws, { type: 'failed', jobId: job.id, error });
        ws.close();
        return;
      }
    });

    ws.on('close', removeListeners);
  });
}
