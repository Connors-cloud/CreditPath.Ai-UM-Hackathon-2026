import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { findUnreadByUserId, markRead } from '../../models/notificationModel.js';

const router = Router();

// Shared routes (auth required)
router.get('/notifications', requireAuth, (req, res, next) => {
  try {
    const result = findUnreadByUserId(req.user.id);
    res.json({ notifications: result.data });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/read', requireAuth, (req, res, next) => {
  try {
    markRead(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { router as applicationRouter };
