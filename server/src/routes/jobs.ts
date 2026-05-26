import { Router, type NextFunction, type Request, type Response } from 'express';
import { createJob, deleteJob, getJob } from '../jobs/repo.js';
import { enqueueJob } from '../jobs/runner.js';

const router = Router();

router.post('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const job = createJob();
    try {
      enqueueJob(job.id);
    } catch (enqueueErr) {
      // enqueueJob threw synchronously — clean up the orphaned job row
      deleteJob(job.id);
      throw enqueueErr;
    }
    res.status(201).json({ id: job.id });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

export default router;
