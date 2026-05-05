import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'studentModel';

/**
 * Find student profile by user_id.
 * @param {string} userId
 * @returns {{ ok: boolean, data?: object }}
 */
export function findByUserId(userId) {
  const fn = 'findByUserId';
  try {
    log.info({ module: MODULE, fn, userId }, 'Finding student');
    const row = getDb().prepare('SELECT * FROM students WHERE user_id = ?').get(userId);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, userId, err }, 'Failed to find student');
    throw err;
  }
}

/**
 * Insert a new student profile row.
 * @param {{ user_id: string, reg_no?: string, ic_no?: string, diploma_institution?: string, diploma_programme?: string, cgpa?: number, intended_programme_id?: string }} student
 * @returns {{ ok: boolean, data?: object }}
 */
export function createStudent(student) {
  const fn = 'createStudent';
  try {
    log.info({ module: MODULE, fn, userId: student.user_id }, 'Creating student profile');
    getDb()
      .prepare(
        `INSERT INTO students (user_id, reg_no, ic_no, diploma_institution, diploma_programme, cgpa, intended_programme_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        student.user_id,
        student.reg_no || null,
        student.ic_no || null,
        student.diploma_institution || null,
        student.diploma_programme || null,
        student.cgpa || null,
        student.intended_programme_id || null
      );
    return { ok: true, data: student };
  } catch (err) {
    log.error({ module: MODULE, fn, userId: student.user_id, err }, 'Failed to create student profile');
    throw err;
  }
}

/**
 * Update student profile fields.
 * @param {string} userId
 * @param {Partial<{reg_no, ic_no, diploma_institution, diploma_programme, cgpa, intended_programme_id}>} fields
 * @returns {{ ok: boolean }}
 */
export function updateStudent(userId, fields) {
  const fn = 'updateStudent';
  try {
    log.info({ module: MODULE, fn, userId }, 'Updating student profile');
    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), userId];
    getDb().prepare(`UPDATE students SET ${setClauses} WHERE user_id = ?`).run(...values);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, userId, err }, 'Failed to update student profile');
    throw err;
  }
}
