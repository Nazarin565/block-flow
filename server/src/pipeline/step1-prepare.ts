import type { PipelineStep } from './types.js';
import { delay } from './util.js';

const step: PipelineStep = {
  name: 'prepare',
  run: async (_ctx) => {
    await delay(1500);
  },
};

export default step;
