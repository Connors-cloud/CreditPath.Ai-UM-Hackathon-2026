import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';

const MODULE = 'transcriptModel';

/**
 * Insert a transcript record.
 * @param {{ id: string, student_id: string, pdf_hash: string, pdf_path: string, parsed_json: string, cgpa?: number, uploaded_at: number }} transcript
 * @returns {{ ok: boolean, data?: object }}
 */
export function createTranscript(transcript) {
  const fn = 'createTranscript';
  try {
    log.info({ module: MODULE, fn, studentId: transcript.student_id, id: transcript.id }, 'Creating transcript');
    getDb()
      .prepare(
        `INSERT INTO transcripts (id, student_id, pdf_hash, pdf_path, parsed_json, cgpa, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        transcript.id,
        transcript.student_id,
        transcript.pdf_hash,
        transcript.pdf_path,
        transcript.parsed_json,
        transcript.cgpa || null,
        transcript.uploaded_at
      );
    return { ok: true, data: transcript };
  } catch (err) {
    log.error({ module: MODULE, fn, id: transcript.id, err }, 'Failed to create transcript');
    throw err;
  }
}

/**
 * Find a transcript by ID.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object }}
 */
export function findById(id) {
  const fn = 'findById';
  try {
    const row = getDb().prepare('SELECT * FROM transcripts WHERE id = ?').get(id);
    return { ok: true, data: row || null };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to find transcript');
    throw err;
  }
}

/**
 * Find all transcripts for a student.
 * @param {string} studentId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findByStudentId(studentId) {
  const fn = 'findByStudentId';
  try {
    const rows = getDb().prepare('SELECT * FROM transcripts WHERE student_id = ? ORDER BY uploaded_at DESC').all(studentId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, studentId, err }, 'Failed to find transcripts for student');
    throw err;
  }
}

/**
 * Insert a batch of transcript entry rows.
 * @param {Array<{id: string, transcript_id: string, subject_code: string, subject_name: string, credit: number, grade: string, semester?: string, remark?: string}>} entries
 * @returns {{ ok: boolean, count: number }}
 */
export function createEntries(entries) {
  const fn = 'createEntries';
  try {
    log.info({ module: MODULE, fn, count: entries.length }, 'Creating transcript entries');
    const stmt = getDb().prepare(
      `INSERT INTO transcript_entries (id, transcript_id, subject_code, subject_name, credit, grade, semester, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insert = getDb().transaction((rows) => {
      for (const e of rows) {
        stmt.run(e.id, e.transcript_id, e.subject_code, e.subject_name, e.credit, e.grade, e.semester || null, e.remark || null);
      }
    });
    insert(entries);
    return { ok: true, count: entries.length };
  } catch (err) {
    log.error({ module: MODULE, fn, err }, 'Failed to create transcript entries');
    throw err;
  }
}

/**
 * Find all entries for a transcript.
 * @param {string} transcriptId
 * @returns {{ ok: boolean, data?: object[] }}
 */
export function findEntriesByTranscriptId(transcriptId) {
  const fn = 'findEntriesByTranscriptId';
  try {
    const rows = getDb().prepare('SELECT * FROM transcript_entries WHERE transcript_id = ?').all(transcriptId);
    return { ok: true, data: rows };
  } catch (err) {
    log.error({ module: MODULE, fn, transcriptId, err }, 'Failed to find transcript entries');
    throw err;
  }
}
