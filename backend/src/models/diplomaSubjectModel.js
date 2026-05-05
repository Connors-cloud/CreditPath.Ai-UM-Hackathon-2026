import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'diplomaSubjectModel';

/**
 * Get all diploma subjects.
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findAll() {
  const fn = 'findAll';
  try {
    const rows = getDb().prepare('SELECT * FROM diploma_subjects ORDER BY code').all();
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to find all diploma subjects');
    throw err;
  }
}

/**
 * Find a diploma subject by code.
 * @param {string} code
 * @returns {{ ok: boolean, data?: object }}
 */
export function findByCode(code) {
  const fn = 'findByCode';
  try {
    const row = getDb().prepare('SELECT * FROM diploma_subjects WHERE code = ?').get(code);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, code, err }, 'Failed to find diploma subject by code');
    throw err;
  }
}

/**
 * Find diploma subjects by list of codes.
 * @param {string[]} codes
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByCodes(codes) {
  const fn = 'findByCodes';
  try {
    if (!codes.length) return { ok: true, data: [] };
    const placeholders = codes.map(() => '?').join(',');
    const rows = getDb().prepare(`SELECT * FROM diploma_subjects WHERE code IN (${placeholders})`).all(...codes);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, codes, err }, 'Failed to find diploma subjects by codes');
    throw err;
  }
}

/**
 * Search diploma subjects by query string (code, name, institution).
 * @param {{ q?: string, institution?: string, code?: string }} params
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function search({ q, institution, code } = {}) {
  const fn = 'search';
  try {
    log.info({ module: MODULE, fn, q, institution, code }, 'Searching diploma subjects');
    let sql = 'SELECT * FROM diploma_subjects WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (institution) {
      sql += ' AND institution LIKE ?';
      params.push(`%${institution}%`);
    }
    if (code) {
      sql += ' AND code LIKE ?';
      params.push(`%${code}%`);
    }
    sql += ' ORDER BY code LIMIT 50';
    const rows = getDb().prepare(sql).all(...params);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to search diploma subjects');
    throw err;
  }
}

/**
 * Insert or replace a diploma subject (used by seeder).
 * @param {object} subject
 * @returns {{ ok: boolean }}
 */
export function upsertSubject(subject) {
  const fn = 'upsertSubject';
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO diploma_subjects
         (id, code, name, credit, institution, synopsis, topics_json, references_json, prerequisites, pdf_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        subject.id, subject.code, subject.name, subject.credit, subject.institution,
        subject.synopsis || null, subject.topics_json, subject.references_json,
        subject.prerequisites || null, subject.pdf_path || null
      );
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, code: subject.code, err }, 'Failed to upsert diploma subject');
    throw err;
  }
}
