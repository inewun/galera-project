import { Router } from 'express';
import { getCollection } from '../openproject/client.js';
import { mapProject } from '../openproject/mappers.js';
import { asyncHandler } from '../middleware/error.js';
import type { Project } from '../openproject/mappers.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const raw = await getCollection<Record<string, any>>('/api/v3/projects');
    const projects: Project[] = raw.map(mapProject);
    res.json(projects);
  }),
);

export default router;
