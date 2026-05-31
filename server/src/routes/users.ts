import { Router } from 'express';
import { getCollection } from '../openproject/client.js';
import { mapUser } from '../openproject/mappers.js';
import { asyncHandler } from '../middleware/error.js';
import type { User } from '../openproject/mappers.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const raw = await getCollection<Record<string, any>>('/api/v3/users');
    const users: User[] = raw.map(mapUser);
    res.json(users);
  }),
);

export default router;