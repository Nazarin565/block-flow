// To add a pipeline step: create a new step file and push it into this array.
// No other code needs to change.
import type { PipelineStep } from './types.js';
import step1 from './step1-prepare.js';
import step2 from './step2-process.js';
import step3 from './step3-finalize.js';

export const STEPS: PipelineStep[] = [step1, step2, step3];
