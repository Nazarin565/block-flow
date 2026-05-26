import type { PipelineStep } from './types.js';
import { tickProgress } from './util.js';

const step: PipelineStep = {
  name: 'process',
  run: async (ctx) => {
    await tickProgress(2000, 33, 67, ctx.onProgress);
  },
};

export default step;
