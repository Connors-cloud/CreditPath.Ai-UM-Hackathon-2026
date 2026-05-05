import { Router } from 'express';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { uploadSingle, uploadMultiple } from '../middleware/multerConfig.js';
import { sha256 } from '../../utils/hash.js';
import { newId } from '../../utils/ids.js';
import { log } from '../../utils/logger.js';
import { extractText } from '../../extractors/pdfTextExtractor.js';
import { parseTranscriptText } from '../../extractors/transcriptParser.js';
import { parseSyllabusText } from '../../extractors/syllabusParser.js';
import { createTranscript, createEntries } from '../../models/transcriptModel.js';
import { getDb } from '../../db/connection.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

// Resolve relative to this file so path is correct regardless of cwd
const UPLOADS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../data/uploads');

router.post('/transcript', uploadSingle, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });

    const buffer = req.file.buffer;
    const hash = sha256(buffer);

    // Check if already processed (content-addressable)
    const existing = getDb().prepare('SELECT * FROM transcripts WHERE pdf_hash = ? AND student_id = ?').get(hash, req.user.id);
    if (existing) {
      return res.json({ transcript_id: existing.id, parsed: JSON.parse(existing.parsed_json), cached: true });
    }

    const text = await extractText(buffer);
    const parsed = parseTranscriptText(text);
    if (!parsed.ok) return res.status(422).json({ error: { code: 'PARSE_FAILED', message: parsed.error } });

    mkdirSync(join(UPLOADS_DIR, 'transcripts'), { recursive: true });
    const filePath = join(UPLOADS_DIR, 'transcripts', `${hash}.pdf`);
    writeFileSync(filePath, buffer);

    const transcriptId = newId();
    const now = Date.now();
    createTranscript({ id: transcriptId, student_id: req.user.id, pdf_hash: hash, pdf_path: filePath, parsed_json: JSON.stringify(parsed.data), cgpa: parsed.data.cgpa, uploaded_at: now });

    const entries = [];
    for (const sem of (parsed.data.semesters || [])) {
      for (const entry of sem.entries) {
        entries.push({ id: newId(), transcript_id: transcriptId, ...entry, semester: sem.semester, remark: null });
      }
    }
    if (entries.length) createEntries(entries);

    log.info({ traceId: req.traceId, transcriptId, entryCount: entries.length }, 'Transcript uploaded and parsed');
    res.status(201).json({ transcript_id: transcriptId, parsed: parsed.data });
  } catch (err) {
    next(err);
  }
});

router.post('/syllabi', uploadMultiple, async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: { code: 'NO_FILES', message: 'No files uploaded' } });

    mkdirSync(join(UPLOADS_DIR, 'syllabi'), { recursive: true });
    const uploaded = [];
    const now = Date.now();

    for (const file of files) {
      const buffer = file.buffer;
      const hash = sha256(buffer);

      const existing = getDb().prepare('SELECT * FROM uploaded_syllabi WHERE pdf_hash = ? AND student_id = ?').get(hash, req.user.id);
      // Only use cache if previous parse succeeded (has subject_code); re-parse if it failed
      if (existing && existing.subject_code) {
        uploaded.push({ id: existing.id, subject_code: existing.subject_code, parsed: existing.parsed_json ? JSON.parse(existing.parsed_json) : null, cached: true });
        continue;
      }

      let parsed = null;
      let subjectCode = null;
      try {
        const text = await extractText(buffer);
        const result = parseSyllabusText(text);
        if (result.ok) { parsed = result.data; subjectCode = result.data.subject_code; }
      } catch {
        log.warn({ traceId: req.traceId, filename: file.originalname }, 'Failed to parse syllabus PDF');
      }

      const filePath = join(UPLOADS_DIR, 'syllabi', `${hash}.pdf`);
      writeFileSync(filePath, buffer);

      if (existing) {
        // Update the previously-failed record with new parse result
        getDb().prepare(
          `UPDATE uploaded_syllabi SET parsed_json = ?, subject_code = ?, pdf_path = ? WHERE id = ?`
        ).run(parsed ? JSON.stringify(parsed) : null, subjectCode, filePath, existing.id);
        uploaded.push({ id: existing.id, subject_code: subjectCode, parsed });
      } else {
        const syllabusId = newId();
        getDb().prepare(
          `INSERT INTO uploaded_syllabi (id, student_id, analysis_id, pdf_hash, pdf_path, parsed_json, subject_code, uploaded_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
        ).run(syllabusId, req.user.id, hash, filePath, parsed ? JSON.stringify(parsed) : null, subjectCode, now);
        uploaded.push({ id: syllabusId, subject_code: subjectCode, parsed });
      }
    }

    res.status(201).json({ uploaded });
  } catch (err) {
    next(err);
  }
});

export { router as uploadRouter };
