// PipelineCtx is intentionally minimal. Steps do not return values or pass data
// forward — the runner (jobs/runner.ts) owns result construction after all steps
// complete. onProgress lets a step report sub-step progress (0–100 absolute %)
// back to the runner without importing jobEvents directly.
export interface PipelineCtx {
  jobId: string;
  onProgress: (absolutePct: number) => void;
}

export interface PipelineStep {
  name: string;
  run: (ctx: PipelineCtx) => Promise<void>;
}
