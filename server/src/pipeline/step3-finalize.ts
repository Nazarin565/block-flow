import type { PipelineStep } from './types.js';
import { tickProgress } from './util.js';

const step: PipelineStep = {
  name: 'finalize',
  run: async (ctx) => {
    await tickProgress(1500, 67, 100, ctx.onProgress);
  },
};

export default step;
