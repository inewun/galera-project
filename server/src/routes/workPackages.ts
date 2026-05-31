import { Router } from 'express';
import { getCollection } from '../openproject/client.js';
import { mapWorkPackage } from '../openproject/mappers.js';
import { asyncHandler } from '../middleware/error.js';
import type { Task } from '../openproject/mappers.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;

    const path = projectId
      ? `/api/v3/projects/${projectId}/work_packages`
      : '/api/v3/work_packages';

    const raw = await getCollection<Record<string, any>>(path);
    const tasks: Task[] = raw.map(mapWorkPackage);

    res.json(tasks);
  }),
);

export default router;