import { Router } from 'express';
import { findAllProgrammes } from '../../models/uniSubjectModel.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'credit-transfer-backend', ts: Date.now() });
});

router.get('/uni-programmes', (_req, res, next) => {
  try {
    const result = findAllProgrammes();
    res.json({ programmes: result.data });
  } catch (err) {
    next(err);
  }
});

export { router as publicRouter };
