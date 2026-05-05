import { log } from '../../utils/logger.js';

/**
 * Global Express error handler. Must be registered last.
 */
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  log.error({ traceId: req.traceId, status, code, err }, 'Unhandled request error');

  res.status(status).json({ error: { code, message } });
}
