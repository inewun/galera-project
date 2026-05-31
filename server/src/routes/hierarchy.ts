import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { readHierarchy, writeHierarchy } from '../hierarchy/store.js';
import type { HierarchyMap } from '../hierarchy/store.js';

const router = Router();

/** GET /api/hierarchy — returns the current hierarchy map. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const hierarchy = await readHierarchy();
    res.json(hierarchy);
  }),
);

/** PUT /api/hierarchy — replaces the entire hierarchy map. */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body;

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.status(400).json({ error: 'Invalid hierarchy' });
      return;
    }

    const saved = await writeHierarchy(body as HierarchyMap);
    res.json(saved);
  }),
);

export default router;