import { EventEmitter } from 'node:events';
import { log } from '../utils/logger.js';

const MODULE = 'sseStream';

// In-memory map: analysisId → EventEmitter
const emitters = new Map();

/**
 * Get or create the EventEmitter for an analysis.
 * @param {string} analysisId
 * @returns {EventEmitter}
 */
export function getEmitter(analysisId) {
  if (!emitters.has(analysisId)) {
    const em = new EventEmitter();
    em.setMaxListeners(20);
    emitters.set(analysisId, em);
  }
  return emitters.get(analysisId);
}

/**
 * Emit an SSE event to all listeners for an analysis.
 * @param {string} analysisId
 * @param {string} eventType
 * @param {object} data
 */
export function emitEvent(analysisId, eventType, data) {
  log.info({ module: MODULE, analysisId, eventType }, 'Emitting SSE event');
  const em = getEmitter(analysisId);
  em.emit('event', { type: eventType, data });
}

/**
 * Attach an Express SSE response to an analysis event stream.
 * Sends events in SSE format until 'analysis_complete' or 'error' is received.
 * @param {string} analysisId
 * @param {import('express').Response} res
 * @param {object[]} [replayEvents] - already-happened events to replay before live stream
 */
export function attachSse(analysisId, res, replayEvents = []) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Replay past events first
  for (const ev of replayEvents) {
    write(ev.type, ev.data);
  }

  const em = getEmitter(analysisId);
  const handler = ({ type, data }) => {
    write(type, data);
    if (type === 'analysis_complete' || type === 'error') {
      cleanup();
    }
  };

  const cleanup = () => {
    em.off('event', handler);
    res.end();
  };

  em.on('event', handler);
  res.on('close', cleanup);
}

/**
 * Remove the emitter for an analysis (called after completion).
 * @param {string} analysisId
 */
export function removeEmitter(analysisId) {
  emitters.delete(analysisId);
}
