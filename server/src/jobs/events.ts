import { EventEmitter } from 'node:events';
import type { JobStatus } from './types.js';

interface JobEventMap {
  status: [{ jobId: string; status: JobStatus }];
  progress: [{ jobId: string; progress: number }];
  done: [{ jobId: string; result: unknown }];
  failed: [{ jobId: string; error: string }];
}

class TypedJobEmitter extends EventEmitter {
  emit<K extends keyof JobEventMap>(event: K, ...args: JobEventMap[K]): boolean {
    return super.emit(event, ...args);
  }
  on<K extends keyof JobEventMap>(event: K, listener: (...args: JobEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  off<K extends keyof JobEventMap>(event: K, listener: (...args: JobEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

const jobEvents = new TypedJobEmitter();
jobEvents.setMaxListeners(0);

export default jobEvents;
