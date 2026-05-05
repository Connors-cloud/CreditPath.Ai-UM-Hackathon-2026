import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'auditLogModel';

/**
 * Write an audit log entry.
 * @param {{ id: string, user_id?: string, action: string, entity_type?: string, entity_id?: string, metadata_json?: string, created_at: number }} entry
 * @returns {{ ok: boolean }}
 */
export function writeLog(entry) {
  const fn = 'writeLog';
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id, entry.user_id || null, entry.action,
        entry.entity_type || null, entry.entity_id || null,
        entry.metadata_json || null, entry.created_at
      );
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, action: entry.action, err }, 'Failed to write audit log');
    throw err;
  }
}

/**
 * Find recent audit log entries for a user.
 * @param {string} userId
 * @param {number} [limit=50]
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByUserId(userId, limit = 50) {
  const fn = 'findByUserId';
  try {
    const rows = getDb()
      .prepare('SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, userId, err }, 'Failed to find audit log');
    throw err;
  }
}
