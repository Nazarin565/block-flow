// PipelineCtx is intentionally minimal. Steps do not return values or pass data
// forward — the runner (jobs/runner.ts) owns result construction after all steps
// complete. Extend this interface if steps ever need shared mutable state.
export interface PipelineCtx {
  jobId: string;
}

export interface PipelineStep {
  name: string;
  run: (ctx: PipelineCtx) => Promise<void>;
}
