import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'matchCacheModel';

/**
 * Look up a cached LLM verdict by cache key.
 * @param {string} cacheKey
 * @returns {{ ok: boolean, data?: object|null }}
 */
export function findByKey(cacheKey) {
  const fn = 'findByKey';
  try {
    const row = getDb().prepare('SELECT * FROM match_cache WHERE cache_key = ?').get(cacheKey);
    if (row) {
      log.info({ module: MODULE, fn, cacheKey }, 'Cache HIT');
    } else {
      log.info({ module: MODULE, fn, cacheKey }, 'Cache MISS');
    }
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, cacheKey, err }, 'Failed to look up match cache');
    throw err;
  }
}

/**
 * Store an LLM verdict in the cache.
 * @param {{ cache_key: string, uni_subject_code: string, diploma_subject_codes_json: string, phase1_result_json: string, llm_verdict_json: string, created_at: number }} entry
 * @returns {{ ok: boolean }}
 */
export function upsert(entry) {
  const fn = 'upsert';
  try {
    log.info({ module: MODULE, fn, cacheKey: entry.cache_key }, 'Writing to match cache');
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO match_cache
         (cache_key, uni_subject_code, diploma_subject_codes_json, phase1_result_json, llm_verdict_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.cache_key, entry.uni_subject_code, entry.diploma_subject_codes_json,
        entry.phase1_result_json, entry.llm_verdict_json, entry.created_at
      );
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, cacheKey: entry.cache_key, err }, 'Failed to write match cache');
    throw err;
  }
}
