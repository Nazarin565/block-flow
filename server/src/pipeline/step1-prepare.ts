import type { PipelineStep } from './types.js';
import { tickProgress } from './util.js';

const step: PipelineStep = {
  name: 'prepare',
  run: async (ctx) => {
    await tickProgress(1500, 0, 33, ctx.onProgress);
  },
};

export default step;
