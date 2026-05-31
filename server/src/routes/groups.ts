import { Router } from 'express';
import { getCollection } from '../openproject/client.js';
import { mapGroup } from '../openproject/mappers.js';
import { asyncHandler } from '../middleware/error.js';
import type { Group } from '../openproject/mappers.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const raw = await getCollection<Record<string, any>>('/api/v3/groups');
    const groups: Group[] = raw.map(mapGroup);
    res.json(groups);
  }),
);

export default router;