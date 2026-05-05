/**
 * Normalize a topic title for exact string comparison.
 * Lowercases, strips punctuation, collapses whitespace.
 * @param {string} s
 * @returns {string}
 */
export function normalizeTitle(s) {
  if (typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')   // punctuation → space
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim();
}
