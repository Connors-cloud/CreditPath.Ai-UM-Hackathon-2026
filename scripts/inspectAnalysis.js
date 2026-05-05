/**
 * Debug utility: inspect a stored analysis record from the SQLite database.
 * Usage: node scripts/inspectAnalysis.js <analysis_id>
 *        node scripts/inspectAnalysis.js --list [limit]
 */
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const DB_PATH = resolve('./backend/data/credit_transfer.db');

let db;
try {
  db = new DatabaseSync(DB_PATH);
} catch (e) {
  console.error(`Cannot open database at ${DB_PATH}:`, e.message);
  process.exit(1);
}

const [,, cmd, arg] = process.argv;

if (cmd === '--list') {
  const limit = parseInt(arg) || 20;
  const rows = db.prepare(`
    SELECT a.id, a.status, a.type, a.created_at,
           u.name AS student_name, u.email AS student_email
    FROM analyses a
    LEFT JOIN users u ON u.id = a.student_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit);

  if (!rows.length) { console.log('No analyses found.'); process.exit(0); }
  console.log(`\n=== Last ${rows.length} analyses ===\n`);
  rows.forEach(r => {
    const date = new Date(r.created_at).toISOString();
    console.log(`  ${r.id}  [${r.status}]  ${r.type}  ${date}  ${r.student_name} <${r.student_email}>`);
  });
  process.exit(0);
}

const analysisId = cmd;
if (!analysisId) {
  console.log('Usage:');
  console.log('  node scripts/inspectAnalysis.js <analysis_id>');
  console.log('  node scripts/inspectAnalysis.js --list [limit]');
  process.exit(1);
}

const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
if (!row) { console.error(`Analysis not found: ${analysisId}`); process.exit(1); }

console.log('\n=== Analysis ===');
console.log(`ID:         ${row.id}`);
console.log(`Type:       ${row.type}`);
console.log(`Status:     ${row.status}`);
console.log(`Created:    ${new Date(row.created_at).toISOString()}`);
console.log(`Student ID: ${row.student_id}`);
console.log(`Programme:  ${row.target_programme_id}`);
if (row.error_message) console.log(`Error:      ${row.error_message}`);

if (row.result_json) {
  try {
    const result = JSON.parse(row.result_json);
    console.log('\n=== Phase 1–3 Result ===');
    console.log(`  Verdicts: ${result.verdicts?.length || 0}`);
    if (result.verdicts) {
      result.verdicts.forEach(v => {
        const icon = v.recommended ? '✓' : '✗';
        console.log(`  ${icon} ${v.uni_code} ← ${v.diploma_codes?.join('+')}  coverage=${v.coverage_percent}%  grade_ok=${v.grade_ok}`);
        if (v.reason) console.log(`      Reason: ${v.reason}`);
      });
    }
  } catch (e) {
    console.log('  [could not parse result_json]');
  }
}

if (row.strategies_json) {
  try {
    const strategies = JSON.parse(row.strategies_json);
    console.log('\n=== Strategies ===');
    if (strategies.recommendation) console.log(`  Recommendation: ${strategies.recommendation}`);
    (strategies.strategies || []).forEach((s, i) => {
      console.log(`\n  Strategy ${i + 1}: ${s.label}`);
      console.log(`    Credits: ${s.total_credits_transferred}  Subjects: ${s.uni_subjects_transferred_count}`);
      console.log(`    ${s.explanation}`);
      (s.claims || []).forEach(c => {
        console.log(`    → ${c.uni_subject_code} ← ${c.diploma_subject_codes?.join('+')}  ${c.coverage_percent}%  [${c.claim_type}]`);
      });
    });
  } catch (e) {
    console.log('  [could not parse strategies_json]');
  }
}

const items = db.prepare('SELECT * FROM application_items ai JOIN applications app ON app.id = ai.application_id WHERE app.analysis_id = ?').all(analysisId);
if (items.length) {
  console.log(`\n=== Application Items (${items.length}) ===`);
  items.forEach(i => {
    const dec = i.decision || 'pending';
    console.log(`  [${dec}] ${i.uni_subject_code} ← ${i.diploma_subject_codes}  coverage=${i.coverage_percent}%  ${i.lecturer_note || ''}`);
  });
}

db.close();
