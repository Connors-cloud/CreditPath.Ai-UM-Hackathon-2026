import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'lecturerModel';

/**
 * Find lecturer profile by user_id.
 * @param {string} userId
 * @returns {{ ok: boolean, data?: object }}
 */
export function findByUserId(userId) {
  const fn = 'findByUserId';
  try {
    log.info({ module: MODULE, fn, userId }, 'Finding lecturer');
    const row = getDb().prepare('SELECT * FROM lecturers WHERE user_id = ?').get(userId);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, userId, err }, 'Failed to find lecturer');
    throw err;
  }
}

/**
 * Insert a new lecturer profile row.
 * @param {{ user_id: string, department?: string, faculty?: string }} lecturer
 * @returns {{ ok: boolean, data?: object }}
 */
export function createLecturer(lecturer) {
  const fn = 'createLecturer';
  try {
    log.info({ module: MODULE, fn, userId: lecturer.user_id }, 'Creating lecturer profile');
    getDb()
      .prepare('INSERT INTO lecturers (user_id, department, faculty) VALUES (?, ?, ?)')
      .run(lecturer.user_id, lecturer.department || null, lecturer.faculty || 'FTSM');
    return { ok: true, data: lecturer };
  } catch (err) {
    log.error({ module: MODULE, fn, userId: lecturer.user_id, err }, 'Failed to create lecturer profile');
    throw err;
  }
}
