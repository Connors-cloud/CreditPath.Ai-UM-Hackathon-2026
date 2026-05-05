import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'applicationModel';

/**
 * Insert a new application.
 * @param {object} app
 * @returns {{ ok: boolean, data?: object }}
 */
export function createApplication(app) {
  const fn = 'createApplication';
  try {
    log.info({ module: MODULE, fn, id: app.id, studentId: app.student_id }, 'Creating application');
    getDb()
      .prepare(
        `INSERT INTO applications
         (id, student_id, analysis_id, target_programme_id, chosen_strategy_index, strategy_json, status, submitted_at, last_updated_at, last_student_activity_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        app.id, app.student_id, app.analysis_id, app.target_programme_id,
        app.chosen_strategy_index, app.strategy_json, app.status || 'submitted',
        app.submitted_at, app.last_updated_at, app.last_student_activity_at
      );
    return { ok: true, data: app };
  } catch (err) {
    log.error({ module: MODULE, fn, id: app.id, err }, 'Failed to create application');
    throw err;
  }
}

/**
 * Find an application by ID.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object }}
 */
export function findById(id) {
  const fn = 'findById';
  try {
    const row = getDb().prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to find application');
    throw err;
  }
}

/**
 * Find all applications for a student.
 * @param {string} studentId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByStudentId(studentId) {
  const fn = 'findByStudentId';
  try {
    const rows = getDb()
      .prepare('SELECT * FROM applications WHERE student_id = ? ORDER BY submitted_at DESC')
      .all(studentId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, studentId, err }, 'Failed to find applications for student');
    throw err;
  }
}

/**
 * Find applications by status (for lecturer inbox).
 * @param {{ status?: string, programme_id?: string }} filters
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByFilters({ status, programme_id } = {}) {
  const fn = 'findByFilters';
  try {
    log.info({ module: MODULE, fn, status, programme_id }, 'Finding applications by filters');
    let sql = 'SELECT * FROM applications WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (programme_id) { sql += ' AND target_programme_id = ?'; params.push(programme_id); }
    sql += ' ORDER BY submitted_at DESC';
    const rows = getDb().prepare(sql).all(...params);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to find applications by filters');
    throw err;
  }
}

/**
 * Update application status or report path.
 * @param {string} id
 * @param {object} fields
 * @returns {{ ok: boolean }}
 */
export function updateApplication(id, fields) {
  const fn = 'updateApplication';
  try {
    log.info({ module: MODULE, fn, id }, 'Updating application');
    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    getDb().prepare(`UPDATE applications SET ${setClauses} WHERE id = ?`).run(...values);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to update application');
    throw err;
  }
}

/**
 * Insert application items.
 * @param {object[]} items
 * @returns {{ ok: boolean }}
 */
export function createItems(items) {
  const fn = 'createItems';
  try {
    log.info({ module: MODULE, fn, count: items.length }, 'Creating application items');
    const stmt = getDb().prepare(
      `INSERT INTO application_items
       (id, application_id, uni_subject_code, diploma_subject_codes_json, claim_type, agent_verdict, agent_reason, agent_coverage_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertAll = getDb().transaction((rows) => {
      for (const item of rows) {
        stmt.run(item.id, item.application_id, item.uni_subject_code, item.diploma_subject_codes_json,
          item.claim_type, item.agent_verdict, item.agent_reason, item.agent_coverage_percent);
      }
    });
    insertAll(items);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to create application items');
    throw err;
  }
}

/**
 * Find all items for an application.
 * @param {string} applicationId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findItemsByApplicationId(applicationId) {
  const fn = 'findItemsByApplicationId';
  try {
    const rows = getDb()
      .prepare('SELECT * FROM application_items WHERE application_id = ?')
      .all(applicationId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, applicationId, err }, 'Failed to find application items');
    throw err;
  }
}

/**
 * Update a single item's lecturer decision.
 * @param {string} itemId
 * @param {{ lecturer_decision: string, lecturer_note?: string, decided_at: number, decided_by: string }} fields
 * @returns {{ ok: boolean }}
 */
export function updateItemDecision(itemId, fields) {
  const fn = 'updateItemDecision';
  try {
    log.info({ module: MODULE, fn, itemId, decision: fields.lecturer_decision }, 'Updating item decision');
    getDb()
      .prepare(
        `UPDATE application_items SET lecturer_decision = ?, lecturer_note = ?, decided_at = ?, decided_by = ? WHERE id = ?`
      )
      .run(fields.lecturer_decision, fields.lecturer_note || null, fields.decided_at, fields.decided_by, itemId);
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, itemId, err }, 'Failed to update item decision');
    throw err;
  }
}
