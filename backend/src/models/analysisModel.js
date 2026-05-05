import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'analysisModel';

/**
 * Insert a new analysis record.
 * @param {object} analysis
 * @returns {{ ok: boolean, data?: object }}
 */
export function createAnalysis(analysis) {
  const fn = 'createAnalysis';
  try {
    log.info({ module: MODULE, fn, id: analysis.id, studentId: analysis.student_id }, 'Creating analysis');
    getDb()
      .prepare(
        `INSERT INTO analyses (id, student_id, type, target_programme_id, status, prompt_text, transcript_id, syllabus_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        analysis.id, analysis.student_id, analysis.type, analysis.target_programme_id,
        analysis.status || 'pending', analysis.prompt_text || null,
        analysis.transcript_id || null, analysis.syllabus_ids_json || null,
        analysis.created_at
      );
    return { ok: true, data: analysis };
  } catch (err) {
    log.error({ module: MODULE, fn, id: analysis.id, err }, 'Failed to create analysis');
    throw err;
  }
}

/**
 * Find an analysis by ID.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object }}
 */
export function findById(id) {
  const fn = 'findById';
  try {
    const row = getDb().prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to find analysis');
    throw err;
  }
}

/**
 * Find all analyses for a student.
 * @param {string} studentId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByStudentId(studentId) {
  const fn = 'findByStudentId';
  try {
    const rows = getDb()
      .prepare('SELECT * FROM analyses WHERE student_id = ? ORDER BY created_at DESC')
      .all(studentId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, studentId, err }, 'Failed to find analyses for student');
    throw err;
  }
}

/**
 * Update analysis status and optional fields.
 * @param {string} id
 * @param {{ status?: string, result_json?: string, strategies_json?: string, error_message?: string, completed_at?: number }} fields
 * @returns {{ ok: boolean }}
 */
export function updateAnalysis(id, fields) {
  const fn = 'updateAnalysis';
  try {
    log.info({ module: MODULE, fn, id, status: fields.status }, 'Updating analysis');
    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    getDb().prepare(`UPDATE analyses SET ${setClauses} WHERE id = ?`).run(...values);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to update analysis');
    throw err;
  }
}
