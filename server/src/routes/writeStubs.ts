import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.post('/work-packages', (_req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: `WRITE_ENABLED=${config.writeEnabled}`,
  });
});

router.patch('/work-packages/:id', (_req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: `WRITE_ENABLED=${config.writeEnabled}`,
  });
});

router.delete('/work-packages/:id', (_req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    detail: `WRITE_ENABLED=${config.writeEnabled}`,
  });
});

export default router;