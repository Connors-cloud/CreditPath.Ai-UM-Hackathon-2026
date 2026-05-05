import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { log } from '../../utils/logger.js';

/**
 * Verify JWT and attach req.user = { id, role, name }.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  // Allow token via query param for SSE streams and PDF downloads (EventSource/window.open can't set headers)
  const rawToken = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!rawToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } });
  }

  const token = rawToken;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    log.warn({ traceId: req.traceId, err: err.message }, 'Invalid JWT');
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

/**
 * Require a specific role. Must be used after requireAuth.
 * @param {string} role
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }
    if (req.user.role !== role) {
      log.warn({ traceId: req.traceId, userId: req.user.id, requiredRole: role, actualRole: req.user.role }, 'Forbidden: wrong role');
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: `Requires role: ${role}` } });
    }
    next();
  };
}
