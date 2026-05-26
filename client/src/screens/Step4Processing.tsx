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

const LOADING_MESSAGES = [
  { title: 'Creating something good for you…',  subtitle: 'This will only take a moment — your item is almost ready.' },
  { title: 'Analysing your goals…',             subtitle: 'We\'re tailoring the plan specifically for you.' },
  { title: 'Building your personal plan…',      subtitle: 'Almost there — just a few more seconds.' },
  { title: 'Putting the final touches…',        subtitle: 'Your plan is nearly ready!' },
];

const REVIEWS = [
  { name: 'John',  stars: 5, text: '"I love this website! It makes practicing so easy and relaxing."' },
  { name: 'Sarah', stars: 5, text: '"The progress tracking keeps me motivated every single day."' },
  { name: 'Mike',  stars: 5, text: '"Simple, beautiful, and actually works. Highly recommended!"' },
  { name: 'Emma',  stars: 5, text: '"Finally a plan that feels made just for me. Love it!"' },
];

interface Props { onboarding: OnboardingHandle; }

export default function Step4Processing({ onboarding }: Props) {
  const { reset } = onboarding;
  const [local, setLocal]             = useState<LocalState>(INITIAL);
  const [msgIndex, setMsgIndex]       = useState(0);
  const [msgVisible, setMsgVisible]   = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewVisible, setReviewVisible] = useState(true);

  // per-call token: teardown increments it; each handler captures its own snapshot
  const callTokenRef = useRef(0);
  const unsubRef     = useRef<(() => void) | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const msgInterval  = useRef<ReturnType<typeof setInterval>  | null>(null);
  const revInterval  = useRef<ReturnType<typeof setInterval>  | null>(null);
  const msgTimeout   = useRef<ReturnType<typeof setTimeout>   | null>(null);
  const revTimeout   = useRef<ReturnType<typeof setTimeout>   | null>(null);

  function clearTimers() {
    if (msgInterval.current) { clearInterval(msgInterval.current);  msgInterval.current = null; }
    if (revInterval.current) { clearInterval(revInterval.current);  revInterval.current = null; }
    if (msgTimeout.current)  { clearTimeout(msgTimeout.current);    msgTimeout.current  = null; }
    if (revTimeout.current)  { clearTimeout(revTimeout.current);    revTimeout.current  = null; }
  }

  function startTimers() {
    clearTimers();
    msgInterval.current = setInterval(() => {
      setMsgVisible(false);
      msgTimeout.current = setTimeout(() => {
        setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
        setMsgVisible(true);
        msgTimeout.current = null;
      }, 300);
    }, 2500);
    revInterval.current = setInterval(() => {
      setReviewVisible(false);
      revTimeout.current = setTimeout(() => {
        setReviewIndex(i => (i + 1) % REVIEWS.length);
        setReviewVisible(true);
        revTimeout.current = null;
      }, 300);
    }, 4000);
  }

  function teardown() {
    callTokenRef.current += 1;
    unsubRef.current?.();
    unsubRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    clearTimers();
  }

  useEffect(() => () => { teardown(); }, []);

  async function handleWs() {
    teardown();
    const myToken = callTokenRef.current;
    setLocal({ ...INITIAL, mode: 'ws' });
    setMsgIndex(0); setMsgVisible(true);
    setReviewIndex(0); setReviewVisible(true);
    startTimers();

    // AbortController for createJob so it can be cancelled by teardown
    const ac = new AbortController();
    abortRef.current = ac;

    let id: string;
    try {
      ({ id } = await createJob(ac.signal));
    } catch {
      if (callTokenRef.current === myToken) {
        clearTimers();
        setLocal(s => ({ ...s, error: 'Failed to create job' }));
      }
      return;
    }

    if (callTokenRef.current !== myToken) return;

    const unsub = subscribeJob(id, msg => {
      if (callTokenRef.current !== myToken) return;
      if (msg.type === 'snapshot') {
        setLocal(s => ({ ...s, status: msg.job.status, progress: msg.job.progress }));
      } else if (msg.type === 'progress') {
        setLocal(s => ({ ...s, progress: msg.progress }));
      } else if (msg.type === 'status') {
        if (msg.status === 'done' || msg.status === 'failed') {
          clearTimers();
          unsubRef.current?.(); unsubRef.current = null;
          setLocal(s => ({ ...s, status: msg.status }));
        } else {
          setLocal(s => ({ ...s, status: msg.status }));
        }
      } else if (msg.type === 'done') {
        clearTimers();
        unsubRef.current?.(); unsubRef.current = null;
        setLocal(s => ({ ...s, status: 'done', result: msg.result }));
      } else if (msg.type === 'failed') {
        clearTimers();
        unsubRef.current?.(); unsubRef.current = null;
        setLocal(s => ({ ...s, status: 'failed', error: msg.error }));
      } else if (msg.type === 'error') {
        clearTimers();
        unsubRef.current?.(); unsubRef.current = null;
        setLocal(s => ({ ...s, status: 'failed', error: msg.message }));
      }
    });
    unsubRef.current = unsub;
  }

  async function handleHttp() {
    teardown();
    const myToken = callTokenRef.current;
    setLocal({ ...INITIAL, mode: 'http' });
    setMsgIndex(0); setMsgVisible(true);
    setReviewIndex(0); setReviewVisible(true);
    startTimers();

    const ac = new AbortController();
    abortRef.current = ac;

    let id: string;
    try {
      ({ id } = await createJob(ac.signal));
    } catch {
      if (callTokenRef.current === myToken) {
        clearTimers();
        setLocal(s => ({ ...s, error: 'Failed to create job' }));
      }
      return;
    }

    if (callTokenRef.current !== myToken) return;

    try {
      for await (const job of pollJob(id, { signal: ac.signal })) {
        if (callTokenRef.current !== myToken) break;
        if (job.status === 'done') {
          clearTimers();
          setLocal(s => ({ ...s, status: 'done', result: job.result }));
          break;
        }
        if (job.status === 'failed') {
          clearTimers();
          setLocal(s => ({ ...s, status: 'failed', error: 'Job failed' }));
          break;
        }
        setLocal(s => ({ ...s, status: job.status }));
      }
    } catch {
      if (callTokenRef.current === myToken) {
        clearTimers();
        setLocal(s => ({ ...s, status: 'failed', error: 'Polling failed' }));
      }
    }
  }

  function handleReset() {
    teardown();
    setLocal(INITIAL);
    setMsgIndex(0); setMsgVisible(true);
    setReviewIndex(0); setReviewVisible(true);
    reset();
  }

  const { mode, progress, status, result, error } = local;
  const isRunning = (mode === 'ws' || mode === 'http') && status !== 'done' && status !== 'failed';
  const isDone    = status === 'done';
  const isFailed  = status === 'failed';

  const msg    = LOADING_MESSAGES[msgIndex];
  const review = REVIEWS[reviewIndex];

  return (
    <div className={styles.screen}>

      {mode === 'idle' && (
        <>
          <h1 className={styles.title}>Ready to build your plan?</h1>
          <div className={styles.buttons}>
            <Button onClick={() => { void handleWs(); }}>Run via WebSocket</Button>
            <Button onClick={() => { void handleHttp(); }} variant="secondary">Run via HTTP</Button>
          </div>
        </>
      )}

      {isRunning && (
        <>
          {mode === 'ws' && <CircularProgress value={progress} />}
          {mode === 'http' && (
            <div className={styles.barWrapper}>
              <ProgressBar mode="indeterminate" />
            </div>
          )}

          <div className={`${styles.msgBlock} ${msgVisible ? styles.visible : styles.hidden}`}>
            <h1 className={styles.title}>{msg.title}</h1>
            <p className={styles.subtitle}>{msg.subtitle}</p>
          </div>

          <div className={`${styles.reviewCard} ${reviewVisible ? styles.visible : styles.hidden}`}>
            <div className={styles.reviewTop}>
              <span className={styles.stars}>{'★'.repeat(review.stars)}</span>
              <span className={styles.reviewName}>{review.name}</span>
            </div>
            <p className={styles.reviewText}>{review.text}</p>
          </div>
        </>
      )}

      {isDone && result !== null && (() => {
        const r = result as { title: string; rating: number; summary: string; steps: string[] };
        return (
          <>
            <div className={styles.successIcon}>🎉</div>
            <h1 className={styles.title}>{r.title}</h1>
            <div className={styles.resultStars}>{'★'.repeat(r.rating)}</div>
            <div className={styles.resultCard}>
              <p className={styles.resultSummary}>{r.summary}</p>
              <ul className={styles.resultSteps}>
                {r.steps.map((step, i) => (
                  <li key={i} className={styles.resultStep}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        );
      })()}

      {isFailed && (
        <>
          <h1 className={styles.title}>Something went wrong</h1>
          {error && <p className={styles.errorText}>{error}</p>}
        </>
      )}

      {(isDone || isFailed) && (
        <div className={styles.footer}>
          <Button onClick={handleReset}>Reset</Button>
        </div>
      )}
    </div>
  );
}
