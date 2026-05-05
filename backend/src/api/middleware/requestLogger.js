import { log } from '../../utils/logger.js';
import { newTraceId } from '../../utils/ids.js';

/**
 * Attach a trace ID to each request and log entry/exit.
 */
export function requestLogger(req, res, next) {
  const traceId = newTraceId();
  req.traceId = traceId;

  const startMs = Date.now();
  log.info({ traceId, method: req.method, path: req.path }, 'Request received');

  res.on('finish', () => {
    const ms = Date.now() - startMs;
    log.info({ traceId, method: req.method, path: req.path, status: res.statusCode, ms }, 'Request completed');
  });

  next();
}
