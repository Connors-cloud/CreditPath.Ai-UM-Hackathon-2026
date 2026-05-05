#!/usr/bin/env node
/**
 * Populates the database with uni programmes, subjects, diploma subjects, and demo users.
 * Idempotent: uses INSERT OR REPLACE with deterministic IDs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env
const { config } = await import('dotenv');
config({ path: join(ROOT, '.env') });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'demo-secret-change-in-prod';
if (!process.env.DB_PATH) process.env.DB_PATH = join(ROOT, 'backend/data/credit_transfer.db');

const { getDb } = await import('../backend/src/db/connection.js');
const { runMigrations } = await import('../backend/src/db/migrate.js');

runMigrations();

const db = getDb();

const uniProgrammes = JSON.parse(readFileSync(join(ROOT, 'data/seed/uniProgrammes.json'), 'utf8'));
const uniSubjectsRaw = JSON.parse(readFileSync(join(ROOT, 'data/seed/uniSubjects.json'), 'utf8'));
const diplomaSubjectsRaw = JSON.parse(readFileSync(join(ROOT, 'data/seed/diplomaSubjects.json'), 'utf8'));
const demoStudent = JSON.parse(readFileSync(join(ROOT, 'data/seed/demoStudent.json'), 'utf8'));

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

// --- Seed uni programmes ---
const insertProg = db.prepare(
  `INSERT OR REPLACE INTO uni_programmes (id, code, name, faculty, university) VALUES (?, ?, ?, ?, ?)`
);
for (const p of uniProgrammes) {
  insertProg.run(p.id, p.code, p.name, p.faculty, p.university);
}
console.log(`Seeded ${uniProgrammes.length} uni programmes`);

// --- Seed uni subjects ---
const insertUni = db.prepare(
  `INSERT OR REPLACE INTO uni_subjects
   (id, programme_id, code, name, credit, status, synopsis, topics_json, references_json, prerequisites)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const s of uniSubjectsRaw) {
  insertUni.run(
    s.id, s.programme_id, s.code, s.name, s.credit,
    s.status || null, s.synopsis || null,
    JSON.stringify(s.topics), JSON.stringify(s.references),
    s.prerequisites || null
  );
}
console.log(`Seeded ${uniSubjectsRaw.length} uni subjects`);

// --- Seed diploma subjects ---
const insertDiploma = db.prepare(
  `INSERT OR REPLACE INTO diploma_subjects
   (id, code, name, credit, institution, synopsis, topics_json, references_json, prerequisites, pdf_path)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const diplomaPdfBase = join(ROOT, 'data/mockPdfs/diploma');
for (const s of diplomaSubjectsRaw) {
  const pdfPath = join(diplomaPdfBase, `${s.code}.pdf`);
  insertDiploma.run(
    s.id, s.code, s.name, s.credit, s.institution,
    s.synopsis || null,
    JSON.stringify(s.topics), JSON.stringify(s.references),
    s.prerequisites || null,
    pdfPath
  );
}
console.log(`Seeded ${diplomaSubjectsRaw.length} diploma subjects`);

// --- Seed demo users ---
const DEMO_PASSWORD = 'password123';
const studentHash = await bcrypt.hash(DEMO_PASSWORD, 10);
const lecturerHash = await bcrypt.hash(DEMO_PASSWORD, 10);

const now = Date.now();

// Demo student
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('user-demo-student', 'student@demo.com', studentHash, 'student', demoStudent.user.name, now);

db.prepare(`INSERT OR REPLACE INTO students (user_id, reg_no, ic_no, diploma_institution, diploma_programme, cgpa, intended_programme_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(
    'user-demo-student',
    demoStudent.student.reg_no,
    demoStudent.student.ic_no,
    demoStudent.student.diploma_institution,
    demoStudent.student.diploma_programme,
    demoStudent.student.cgpa,
    demoStudent.student.intended_programme_id
  );
console.log('Seeded demo student: student@demo.com / password123');

// Demo lecturer
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
  .run('user-demo-lecturer', 'lecturer@demo.com', lecturerHash, 'lecturer', 'Dr. Ahmad Fadzil', now);

db.prepare(`INSERT OR REPLACE INTO lecturers (user_id, department, faculty) VALUES (?, ?, ?)`)
  .run('user-demo-lecturer', 'Information Technology', 'FTSM');
console.log('Seeded demo lecturer: lecturer@demo.com / password123');

// --- Seed demo transcript ---
const transcriptId = 'transcript-demo-student-001';
const transcriptPdfPath = join(ROOT, 'data/mockPdfs/demo/transcript.pdf');
const transcriptPdfHash = sha256('demo-transcript-khew-jun-yu');

const parsedTranscript = JSON.stringify({
  student_name: demoStudent.transcript.student_name,
  reg_no: demoStudent.transcript.reg_no,
  cgpa: demoStudent.transcript.cgpa,
  semesters: demoStudent.transcript.semesters
});

db.prepare(
  `INSERT OR REPLACE INTO transcripts (id, student_id, pdf_hash, pdf_path, parsed_json, cgpa, uploaded_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(transcriptId, 'user-demo-student', transcriptPdfHash, transcriptPdfPath, parsedTranscript, demoStudent.transcript.cgpa, now);

// Seed transcript entries
const insertEntry = db.prepare(
  `INSERT OR REPLACE INTO transcript_entries (id, transcript_id, subject_code, subject_name, credit, grade, semester, remark)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

let entryCount = 0;
for (const sem of demoStudent.transcript.semesters) {
  for (const entry of sem.entries) {
    const entryId = `te-${sha256(`${transcriptId}-${entry.subject_code}`).slice(0, 16)}`;
    insertEntry.run(entryId, transcriptId, entry.subject_code, entry.subject_name, entry.credit, entry.grade, sem.semester, null);
    entryCount++;
  }
}
console.log(`Seeded ${entryCount} transcript entries for demo student`);

// --- Seed uploaded_syllabi referencing diploma PDFs ---
const insertSyllabus = db.prepare(
  `INSERT OR REPLACE INTO uploaded_syllabi (id, student_id, analysis_id, pdf_hash, pdf_path, parsed_json, subject_code, uploaded_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

let syllabusCount = 0;
for (const subj of diplomaSubjectsRaw) {
  const pdfPath = join(ROOT, 'data/mockPdfs/diploma', `${subj.code}.pdf`);
  const pdfHash = sha256(`mock-diploma-${subj.code}`);
  const syllabusId = `syll-demo-${sha256(subj.code).slice(0, 12)}`;
  const parsedJson = JSON.stringify({
    subject_code: subj.code,
    subject_name: subj.name,
    institution: subj.institution,
    topics: subj.topics,
    references: subj.references
  });
  insertSyllabus.run(syllabusId, 'user-demo-student', null, pdfHash, pdfPath, parsedJson, subj.code, now);
  syllabusCount++;
}
console.log(`Seeded ${syllabusCount} uploaded syllabi for demo student`);

// --- Print row counts ---
const tables = ['users', 'students', 'lecturers', 'uni_programmes', 'uni_subjects', 'diploma_subjects', 'transcripts', 'transcript_entries', 'uploaded_syllabi'];
console.log('\n=== Row counts ===');
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get();
  console.log(`  ${t.padEnd(22)}: ${count.n}`);
}
console.log('\nSeed complete.');
