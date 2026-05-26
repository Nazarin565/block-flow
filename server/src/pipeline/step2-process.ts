import type { PipelineStep } from './types.js';
import { delay } from './util.js';

const step: PipelineStep = {
  name: 'process',
  run: async (_ctx) => {
    await delay(2000);
  },
};

export default step;
