import { useEffect, useRef, useState } from 'react';
import type { OnboardingHandle } from '../state/onboarding';
import type { JobStatus } from '../api/types';
import { createJob, pollJob } from '../api/http';
import { subscribeJob } from '../api/ws';
import CircularProgress from '../components/CircularProgress';
import ProgressBar from '../components/ProgressBar';
import Button from '../components/Button';
import styles from './Step4Processing.module.css';

type Mode = 'idle' | 'ws' | 'http';

interface LocalState {
  mode: Mode;
  progress: number;
  status: JobStatus | null;
  result: unknown | null;
  error: string | null;
}

const INITIAL: LocalState = { mode: 'idle', progress: 0, status: null, result: null, error: null };

interface Props { onboarding: OnboardingHandle; }

export default function Step4Processing({ onboarding }: Props) {
  const { reset } = onboarding;
  const [local, setLocal] = useState<LocalState>(INITIAL);

  const unsubRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function teardown() {
    unsubRef.current?.();
    unsubRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }

  useEffect(() => () => { teardown(); }, []);

  async function handleWs() {
    teardown();
    setLocal({ ...INITIAL, mode: 'ws' });
    // cancelled flag guards against race: if a second click fires during createJob await,
    // teardown runs before unsub is stored, so we must not store it after cancellation
    let cancelled = false;
    const prevTeardown = teardown;
    void prevTeardown; // used implicitly via the flag
    const origTeardown = () => { cancelled = true; };
    unsubRef.current = origTeardown;

    let id: string;
    try {
      ({ id } = await createJob());
    } catch {
      if (!cancelled) setLocal(s => ({ ...s, error: 'Failed to create job' }));
      return;
    }

    if (cancelled) return;

    const unsub = subscribeJob(id, msg => {
      if (msg.type === 'snapshot') {
        setLocal(s => ({ ...s, status: msg.job.status, progress: msg.job.progress }));
      } else if (msg.type === 'progress') {
        setLocal(s => ({ ...s, progress: msg.progress }));
      } else if (msg.type === 'status') {
        // do not transition to done/failed via status frame — use done/failed frames for terminal state
        if (msg.status !== 'done' && msg.status !== 'failed') {
          setLocal(s => ({ ...s, status: msg.status }));
        }
      } else if (msg.type === 'done') {
        setLocal(s => ({ ...s, status: 'done', result: msg.result }));
      } else if (msg.type === 'failed') {
        setLocal(s => ({ ...s, status: 'failed', error: msg.error }));
      } else if (msg.type === 'error') {
        setLocal(s => ({ ...s, status: 'failed', error: msg.message }));
      }
    });
    unsubRef.current = unsub;
  }

  async function handleHttp() {
    teardown();
    setLocal({ ...INITIAL, mode: 'http' });
    let cancelled = false;
    abortRef.current = { abort: () => { cancelled = true; } } as AbortController;

    let id: string;
    try {
      ({ id } = await createJob());
    } catch {
      if (!cancelled) setLocal(s => ({ ...s, error: 'Failed to create job' }));
      return;
    }

    if (cancelled) return;

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      for await (const job of pollJob(id, { signal: ac.signal })) {
        if (job.status === 'done') {
          setLocal(s => ({ ...s, status: 'done', result: job.result }));
          break;
        }
        if (job.status === 'failed') {
          setLocal(s => ({ ...s, status: 'failed', error: 'Job failed' }));
          break;
        }
        setLocal(s => ({ ...s, status: job.status }));
      }
    } catch {
      if (!ac.signal.aborted) {
        setLocal(s => ({ ...s, status: 'failed', error: 'Polling failed' }));
      }
    }
  }

  function handleReset() {
    teardown();
    setLocal(INITIAL);
    reset();
  }

  const { mode, progress, status, result, error } = local;
  const isRunning = (mode === 'ws' || mode === 'http') && status !== 'done' && status !== 'failed';
  const isDone = status === 'done';
  const isFailed = status === 'failed';

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>
        {isDone ? 'Your plan is ready!' : isFailed ? 'Something went wrong' : 'Building your plan…'}
      </h1>

      {mode === 'idle' && (
        <div className={styles.buttons}>
          <Button onClick={() => { void handleWs(); }}>Run via WebSocket</Button>
          <Button onClick={() => { void handleHttp(); }} variant="secondary">Run via HTTP</Button>
        </div>
      )}

      {mode === 'ws' && isRunning && (
        <CircularProgress value={progress} />
      )}

      {mode === 'http' && isRunning && (
        <div className={styles.barWrapper}>
          <ProgressBar mode="indeterminate" />
        </div>
      )}

      {isDone && result !== null && (
        <div className={styles.resultCard}>
          <pre className={styles.resultJson}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {isFailed && error && (
        <p className={styles.errorText}>{error}</p>
      )}

      {(isDone || isFailed) && (
        <div className={styles.footer}>
          <Button onClick={handleReset}>Reset</Button>
        </div>
      )}
    </div>
  );
}
