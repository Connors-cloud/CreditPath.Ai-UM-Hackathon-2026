import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'uniSubjectModel';

/**
 * Get all uni subjects for a programme.
 * @param {string} programmeId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByProgrammeId(programmeId) {
  const fn = 'findByProgrammeId';
  try {
    log.info({ module: MODULE, fn, programmeId }, 'Finding uni subjects for programme');
    const rows = getDb().prepare('SELECT * FROM uni_subjects WHERE programme_id = ?').all(programmeId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, programmeId, err }, 'Failed to find uni subjects');
    throw err;
  }
}

/**
 * Find a uni subject by code within a programme.
 * @param {string} programmeId
 * @param {string} code
 * @returns {{ ok: boolean, data?: object }}
 */
export function findByCode(programmeId, code) {
  const fn = 'findByCode';
  try {
    const row = getDb()
      .prepare('SELECT * FROM uni_subjects WHERE programme_id = ? AND code = ?')
      .get(programmeId, code);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, programmeId, code, err }, 'Failed to find uni subject by code');
    throw err;
  }
}

/**
 * Get all uni programmes.
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findAllProgrammes() {
  const fn = 'findAllProgrammes';
  try {
    const rows = getDb().prepare('SELECT * FROM uni_programmes ORDER BY name').all();
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to find all programmes');
    throw err;
  }
}

/**
 * Find a programme by ID.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object }}
 */
export function findProgrammeById(id) {
  const fn = 'findProgrammeById';
  try {
    const row = getDb().prepare('SELECT * FROM uni_programmes WHERE id = ?').get(id);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to find programme');
    throw err;
  }
}

/**
 * Insert a uni subject (used by seeder).
 * @param {object} subject
 * @returns {{ ok: boolean }}
 */
export function upsertSubject(subject) {
  const fn = 'upsertSubject';
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO uni_subjects
         (id, programme_id, code, name, credit, status, synopsis, topics_json, references_json, prerequisites)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        subject.id, subject.programme_id, subject.code, subject.name,
        subject.credit, subject.status || null, subject.synopsis || null,
        subject.topics_json, subject.references_json, subject.prerequisites || null
      );
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, code: subject.code, err }, 'Failed to upsert uni subject');
    throw err;
  }
}

/**
 * Insert a uni programme (used by seeder).
 * @param {object} programme
 * @returns {{ ok: boolean }}
 */
export function upsertProgramme(programme) {
  const fn = 'upsertProgramme';
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO uni_programmes (id, code, name, faculty, university) VALUES (?, ?, ?, ?, ?)`
      )
      .run(programme.id, programme.code, programme.name, programme.faculty || 'FTSM', programme.university || 'UKM');
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, code: programme.code, err }, 'Failed to upsert programme');
    throw err;
  }
}
