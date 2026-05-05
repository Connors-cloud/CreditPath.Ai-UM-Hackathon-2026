#!/usr/bin/env node
/**
 * Runs Phases 0-2 deterministically for the demo student (no LLM).
 * Prints intermediate results: per-pair coverage, grade pass, candidate list,
 * and the optimized assignment.
 *
 * Usage: node scripts/runDemo.js [student_id] [programme_id]
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { config } = await import('dotenv');
config({ path: join(ROOT, '.env') });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'demo-secret-change-in-prod';
if (!process.env.DB_PATH) process.env.DB_PATH = join(ROOT, 'backend/data/credit_transfer.db');

const { getDb } = await import('../backend/src/db/connection.js');
const { runMigrations } = await import('../backend/src/db/migrate.js');
const { matchTopics, buildTopicPool } = await import('../backend/src/matching/titleMatcher.js');
const { gradesAllMeetMinimum } = await import('../backend/src/matching/gradeChecker.js');
const { optimizeAssignment } = await import('../backend/src/optimizer/assignmentOptimizer.js');

runMigrations();
const db = getDb();

const STUDENT_ID = process.argv[2] || 'user-demo-student';
const PROGRAMME_ID = process.argv[3] || 'prog-ukm-ftsm-it';
const EDGE_THRESHOLD = 60; // minimum raw coverage to send to LLM in Phase 3

console.log(`\n${'='.repeat(72)}`);
console.log(` CREDIT TRANSFER ANALYSIS — Phases 0-2 (Deterministic, no LLM)`);
console.log(` Student ID : ${STUDENT_ID}`);
console.log(` Programme  : ${PROGRAMME_ID}`);
console.log(`${'='.repeat(72)}\n`);

// ─── Phase 0: Load data from DB ───────────────────────────────────────────────
console.log('[ Phase 0 ] Loading student data...');

const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(STUDENT_ID);
if (!student) { console.error(`ERROR: Student not found: student_id=${STUDENT_ID}`); process.exit(1); }

const user = db.prepare('SELECT * FROM users WHERE id = ?').get(STUDENT_ID);
const programme = db.prepare('SELECT * FROM uni_programmes WHERE id = ?').get(PROGRAMME_ID);
if (!programme) { console.error(`ERROR: Programme not found: programme_id=${PROGRAMME_ID}`); process.exit(1); }

// Load transcript entries (grade for each diploma subject)
const transcriptRow = db.prepare('SELECT * FROM transcripts WHERE student_id = ? ORDER BY uploaded_at DESC LIMIT 1').get(STUDENT_ID);
if (!transcriptRow) { console.error(`ERROR: No transcript for student_id=${STUDENT_ID}`); process.exit(1); }
const entries = db.prepare('SELECT * FROM transcript_entries WHERE transcript_id = ?').all(transcriptRow.id);

// Build grade lookup: subject_code → grade
const gradeMap = {};
for (const e of entries) gradeMap[e.subject_code] = e.grade;

// Load uploaded syllabi (pre-parsed)
const syllabi = db.prepare(`SELECT * FROM uploaded_syllabi WHERE student_id = ? AND subject_code IS NOT NULL`).all(STUDENT_ID);

// Build diploma subject data from DB (authoritative topic lists)
const diplomaCodes = syllabi.map(s => s.subject_code);
const placeholders = diplomaCodes.map(() => '?').join(',');
const diplomaSubjects = diplomaCodes.length
  ? db.prepare(`SELECT * FROM diploma_subjects WHERE code IN (${placeholders})`).all(...diplomaCodes)
  : [];

// Only include diploma subjects where student has a grade (in transcript)
const studentDiploma = diplomaSubjects.filter(d => gradeMap[d.code] !== undefined);

console.log(`  Student     : ${user?.name}`);
console.log(`  Programme   : ${programme.name} (${programme.code})`);
console.log(`  Transcript  : ${entries.length} subjects`);
console.log(`  Diploma pool: ${studentDiploma.length} subjects with grades\n`);

// Load uni subjects for target programme
const uniSubjects = db.prepare('SELECT * FROM uni_subjects WHERE programme_id = ?').all(PROGRAMME_ID);
console.log(`[ Phase 0 ] Loaded ${uniSubjects.length} uni subjects for ${programme.name}\n`);

// ─── Phase 1 + 2: Deterministic matching ──────────────────────────────────────
console.log('[ Phase 1 ] Title matching | [ Phase 2 ] Grade check\n');
console.log(`${'─'.repeat(72)}`);
console.log(`  UNI SUBJECT                            | COV%  | GRADE | TYPE     | STATUS`);
console.log(`${'─'.repeat(72)}`);

const candidates = []; // pairs that meet edge threshold (≥60% coverage + grade pass)
const qualifiedClaims = []; // pairs that meet 80% + grade pass (for optimizer)

for (const uni of uniSubjects) {
  const uniTopics = JSON.parse(uni.topics_json);

  // --- Standalone claims ---
  for (const dipl of studentDiploma) {
    const diplomaTopics = JSON.parse(dipl.topics_json);
    const { rawCoveragePercent, matched, unmatched } = matchTopics(uniTopics, diplomaTopics);
    const grade = gradeMap[dipl.code];
    const gradePassed = gradesAllMeetMinimum([grade]);

    if (rawCoveragePercent >= EDGE_THRESHOLD || rawCoveragePercent >= 80) {
      const label = rawCoveragePercent >= 80 && gradePassed ? 'QUALIFIES' : rawCoveragePercent >= EDGE_THRESHOLD ? 'EDGE(LLM)' : 'LOW';
      const row = {
        uniCode: uni.code, uniName: uni.name, uniCredits: uni.credit,
        uniTopics,
        diplomaCodes: [dipl.code], diplomaNames: [dipl.name],
        claimType: 'standalone',
        matched, unmatched, rawCoveragePercent,
        grades: { [dipl.code]: grade },
        gradePassed,
        status: rawCoveragePercent >= 80 && gradePassed ? 'qualified' : 'edge'
      };
      candidates.push(row);
      if (rawCoveragePercent >= 80 && gradePassed) {
        qualifiedClaims.push({ uniSubjectCode: uni.code, uniSubjectName: uni.name, diplomaSubjectCodes: [dipl.code], credits: uni.credit, coveragePercent: rawCoveragePercent });
      }
      const name = (uni.name.slice(0, 36) + ' ' + uni.code).padEnd(40);
      const cov = String(rawCoveragePercent + '%').padEnd(6);
      const gradeStr = grade.padEnd(6);
      const typeStr = 'standalone'.padEnd(9);
      console.log(`  ${name}| ${cov}| ${gradeStr}| ${typeStr}| ${label}`);
    }
  }

  // --- Combo claims (pairs) ---
  for (let i = 0; i < studentDiploma.length; i++) {
    for (let j = i + 1; j < studentDiploma.length; j++) {
      const d1 = studentDiploma[i], d2 = studentDiploma[j];
      const pool = buildTopicPool([d1, d2]);
      const { rawCoveragePercent, matched, unmatched } = matchTopics(uniTopics, pool);
      const grades = [gradeMap[d1.code], gradeMap[d2.code]];
      const gradePassed = gradesAllMeetMinimum(grades);

      if (rawCoveragePercent >= 80 && gradePassed) {
        // Only show combos that reach qualified threshold (too many edge combos to print)
        const row = {
          uniCode: uni.code, uniName: uni.name, uniCredits: uni.credit,
          uniTopics,
          diplomaCodes: [d1.code, d2.code], diplomaNames: [d1.name, d2.name],
          claimType: 'combo',
          matched, unmatched, rawCoveragePercent,
          grades: { [d1.code]: gradeMap[d1.code], [d2.code]: gradeMap[d2.code] },
          gradePassed,
          status: 'qualified'
        };
        candidates.push(row);
        qualifiedClaims.push({ uniSubjectCode: uni.code, uniSubjectName: uni.name, diplomaSubjectCodes: [d1.code, d2.code], credits: uni.credit, coveragePercent: rawCoveragePercent });
        const name = (uni.name.slice(0, 36) + ' ' + uni.code).padEnd(40);
        const cov = String(rawCoveragePercent + '%').padEnd(6);
        const gradeStr = `${gradeMap[d1.code]}/${gradeMap[d2.code]}`.padEnd(6);
        const typeStr = 'combo'.padEnd(9);
        console.log(`  ${name}| ${cov}| ${gradeStr}| ${typeStr}| QUALIFIES`);
      }
    }
  }
}

console.log(`${'─'.repeat(72)}\n`);
console.log(`[ Phase 1+2 ] Summary:`);
console.log(`  Total candidate pairs (≥60% or ≥80%): ${candidates.length}`);
console.log(`  Already qualified (≥80% + grade pass): ${qualifiedClaims.length}`);
console.log(`  Would go to LLM Phase 3 (edge 60-79%): ${candidates.filter(c => c.status === 'edge').length}\n`);

// ─── Optimizer ────────────────────────────────────────────────────────────────
console.log('[ Optimizer ] Running assignment optimizer on qualified claims...');
const optimized = optimizeAssignment(qualifiedClaims);

console.log(`\n${'='.repeat(72)}`);
console.log(` OPTIMAL ASSIGNMENT (deterministic, before LLM edge resolution)`);
console.log(`${'='.repeat(72)}`);
console.log(` Total credits transferable: ${optimized.totalCredits}`);
console.log(` Uni subjects transferred  : ${optimized.selected.length}`);
console.log('');

for (const claim of optimized.selected) {
  const type = claim.diplomaSubjectCodes.length === 1 ? 'standalone' : `combo(${claim.diplomaSubjectCodes.length})`;
  console.log(`  ✓ ${claim.uniSubjectName} (${claim.uniSubjectCode}) ← ${claim.diplomaSubjectCodes.join(' + ')} [${claim.credits} cr, ${claim.coveragePercent}%, ${type}]`);
}

const programmeTotal = uniSubjects.reduce((s, u) => s + u.credit, 0);
console.log(`\n  Programme total credits : ${programmeTotal}`);
console.log(`  Transferred             : ${optimized.totalCredits} (${Math.round(optimized.totalCredits / programmeTotal * 100)}%)`);
console.log(`${'='.repeat(72)}\n`);
console.log('Phase 0-2 complete. Phase 3 (LLM) would resolve edge cases and improve coverage.');
