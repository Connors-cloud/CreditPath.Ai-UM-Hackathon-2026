import { nanoid } from 'nanoid';

/**
 * Generate a URL-safe unique ID.
 * @param {number} [size=21]
 * @returns {string}
 */
export function newId(size = 21) {
  return nanoid(size);
}

/**
 * Generate a short request-scoped trace ID (8 chars).
 * @returns {string}
 */
export function newTraceId() {
  return nanoid(8);
}
