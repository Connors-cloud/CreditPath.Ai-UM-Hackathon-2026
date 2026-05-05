import { normalizeTitle } from './titleNormalizer.js';

/**
 * Exact-match uni topic titles against a diploma topic pool after normalization.
 * @param {string[]} uniTopics
 * @param {string[]} diplomaTopicPool - union of topics from one or more diploma subjects
 * @returns {{ matched: string[], unmatched: string[], rawCoveragePercent: number }}
 */
export function matchTopics(uniTopics, diplomaTopicPool) {
  if (!uniTopics.length) return { matched: [], unmatched: [], rawCoveragePercent: 0 };

  const normDiploma = new Set(diplomaTopicPool.map(normalizeTitle));
  const matched = [];
  const unmatched = [];

  for (const topic of uniTopics) {
    if (normDiploma.has(normalizeTitle(topic))) {
      matched.push(topic);
    } else {
      unmatched.push(topic);
    }
  }

  const rawCoveragePercent = Math.round((matched.length / uniTopics.length) * 100);
  return { matched, unmatched, rawCoveragePercent };
}

/**
 * Build the union topic pool from one or more diploma subject objects.
 * @param {Array<{topics_json: string}>} diplomaSubjects
 * @returns {string[]} deduplicated union of all topics
 */
export function buildTopicPool(diplomaSubjects) {
  const seen = new Set();
  const pool = [];
  for (const subj of diplomaSubjects) {
    const topics = typeof subj.topics_json === 'string'
      ? JSON.parse(subj.topics_json)
      : subj.topics_json;
    for (const t of topics) {
      const norm = normalizeTitle(t);
      if (!seen.has(norm)) {
        seen.add(norm);
        pool.push(t);
      }
    }
  }
  return pool;
}
