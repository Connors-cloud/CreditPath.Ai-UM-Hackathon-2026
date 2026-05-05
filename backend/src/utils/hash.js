import { createHash } from 'node:crypto';

/**
 * Compute SHA-256 hash of a Buffer or string.
 * @param {Buffer|string} input
 * @returns {string} hex digest
 */
export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Compute a short deterministic cache key from a list of strings.
 * @param {string[]} parts
 * @returns {string} hex digest
 */
export function hashParts(parts) {
  return sha256(parts.join('|'));
}
