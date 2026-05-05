import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { log } from '../../utils/logger.js';
import { newId } from '../../utils/ids.js';
import { findByEmail, createUser, findById } from '../../models/userModel.js';
import { createStudent } from '../../models/studentModel.js';
import { createLecturer } from '../../models/lecturerModel.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role, studentDetails } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'email, password, name, role required' } });
    }
    if (!['student', 'lecturer'].includes(role)) {
      return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role must be student or lecturer' } });
    }

    const existing = findByEmail(email);
    if (existing.data) {
      return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = newId();
    const now = Date.now();
    createUser({ id, email, password_hash, role, name, created_at: now });

    if (role === 'student') {
      createStudent({ user_id: id, ...(studentDetails || {}) });
    } else if (role === 'lecturer') {
      createLecturer({ user_id: id, department: studentDetails?.department });
    }

    const token = jwt.sign({ id, role, name }, env.JWT_SECRET, { expiresIn: '7d' });
    log.info({ traceId: req.traceId, userId: id, role }, 'User registered');
    res.status(201).json({ token, user: { id, email, name, role } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'email and password required' } });
    }

    const result = findByEmail(email);
    const user = result.data;
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, env.JWT_SECRET, { expiresIn: '7d' });
    log.info({ traceId: req.traceId, userId: user.id, role: user.role }, 'User logged in');
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  // Stateless JWT — client discards token
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const result = findById(req.user.id);
    if (!result.data) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const { password_hash, ...user } = result.data;
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
