import { Router } from 'express';
import { opGet } from '../openproject/client.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    try {
      await opGet('/api/v3/users?pageSize=1');
      res.json({ ok: true, op: 'reachable' });
    } catch {
      res.json({ ok: true, op: 'unreachable' });
    }
  }),
);

export default router;