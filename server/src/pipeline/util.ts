export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Smoothly ticks progress from `from` to `to` (absolute %) over `durationMs`.
// Fires onProgress roughly every TICK_MS with integer values.
const TICK_MS = 80;
export async function tickProgress(
  durationMs: number,
  from: number,
  to: number,
  onProgress: (pct: number) => void,
): Promise<void> {
  const steps = Math.max(1, Math.round(durationMs / TICK_MS));
  const range = to - from;
  for (let i = 1; i <= steps; i++) {
    await delay(Math.round(durationMs / steps));
    const pct = Math.round(from + (range * i) / steps);
    onProgress(pct);
  }
}
