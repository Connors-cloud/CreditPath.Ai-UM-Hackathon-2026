#!/usr/bin/env node
/**
 * Generates simplified, fully-text-extractable PDFs for all uni and diploma subjects.
 * Format: attribute:value pairs, one per line — no images, no scans, 100% parseable.
 * Output: data/mockPdfs/uni/<code>.pdf and data/mockPdfs/diploma/<code>.pdf
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const uniSubjects = JSON.parse(readFileSync(join(ROOT, 'data/seed/uniSubjects.json'), 'utf8'));
const diplomaSubjects = JSON.parse(readFileSync(join(ROOT, 'data/seed/diplomaSubjects.json'), 'utf8'));
const uniProgrammes = JSON.parse(readFileSync(join(ROOT, 'data/seed/uniProgrammes.json'), 'utf8'));

const uniDir = join(ROOT, 'data/mockPdfs/uni');
const diplomaDir = join(ROOT, 'data/mockPdfs/diploma');
const demoDir = join(ROOT, 'data/mockPdfs/demo');

mkdirSync(uniDir, { recursive: true });
mkdirSync(diplomaDir, { recursive: true });
mkdirSync(demoDir, { recursive: true });

const programmeMap = Object.fromEntries(uniProgrammes.map(p => [p.id, p]));

/**
 * Write text to a PDF file line by line.
 * @param {string} filePath
 * @param {string[]} lines
 * @returns {Promise<void>}
 */
function writePdf(filePath, lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);
    doc.font('Courier').fontSize(11);
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function generateUniPdfs() {
  let count = 0;
  for (const subj of uniSubjects) {
    const prog = programmeMap[subj.programme_id] || {};
    const lines = [
      `UNIVERSITY: UKM`,
      `FACULTY: FTSM`,
      `PROGRAMME: ${prog.name || 'Unknown'}`,
      `SUBJECT CODE: ${subj.code}`,
      `SUBJECT NAME: ${subj.name}`,
      `CREDIT: ${subj.credit}`,
      `STATUS: ${subj.status || 'Wajib Program'}`,
      ``,
      `SYNOPSIS:`,
      subj.synopsis || '',
      ``,
      `TOPICS COVERED:`,
      ...subj.topics.map(t => `- ${t}`),
      ``,
      `REFERENCES:`,
      ...subj.references.map(r => `- ${r}`),
      ``,
      `PREREQUISITES: ${subj.prerequisites || 'None'}`
    ];
    const outPath = join(uniDir, `${subj.code}.pdf`);
    await writePdf(outPath, lines);
    count++;
  }
  console.log(`Generated ${count} uni subject PDFs in ${uniDir}`);
}

async function generateDiplomaPdfs() {
  let count = 0;
  for (const subj of diplomaSubjects) {
    const lines = [
      `INSTITUTION: ${subj.institution}`,
      `PROGRAMME: Diploma in Information Technology (Digital Technology)`,
      `SUBJECT CODE: ${subj.code}`,
      `SUBJECT NAME: ${subj.name}`,
      `CREDIT: ${subj.credit}`,
      ``,
      `SYNOPSIS:`,
      subj.synopsis || '',
      ``,
      `TOPICS COVERED:`,
      ...subj.topics.map(t => `- ${t}`),
      ``,
      `REFERENCES:`,
      ...subj.references.map(r => `- ${r}`),
      ``,
      `PREREQUISITES: ${subj.prerequisites || 'None'}`
    ];
    const outPath = join(diplomaDir, `${subj.code}.pdf`);
    await writePdf(outPath, lines);
    count++;
  }
  console.log(`Generated ${count} diploma subject PDFs in ${diplomaDir}`);
}

async function generateDemoTranscript() {
  const demoStudent = JSON.parse(readFileSync(join(ROOT, 'data/seed/demoStudent.json'), 'utf8'));
  const t = demoStudent.transcript;

  const lines = [
    `INSTITUTION: ${demoStudent.student.diploma_institution}`,
    `PROGRAMME: ${demoStudent.student.diploma_programme}`,
    ``,
    `STUDENT NAME: ${t.student_name}`,
    `REGISTRATION NO: ${t.reg_no}`,
    `CUMULATIVE GPA: ${t.cgpa}`,
    ``
  ];

  for (const sem of t.semesters) {
    lines.push(`${sem.semester.toUpperCase()}:`);
    lines.push(`SUBJECT CODE | SUBJECT NAME                          | CREDIT | GRADE`);
    lines.push(`-------------|---------------------------------------|--------|------`);
    for (const e of sem.entries) {
      const name = e.subject_name.padEnd(38);
      lines.push(`${e.subject_code.padEnd(12)} | ${name} | ${String(e.credit).padEnd(6)} | ${e.grade}`);
    }
    lines.push(``);
  }

  lines.push(`CGPA: ${t.cgpa}`);
  lines.push(`TRANSCRIPT STATUS: OFFICIAL`);

  const outPath = join(demoDir, 'transcript.pdf');
  await writePdf(outPath, lines);
  console.log(`Generated demo transcript PDF at ${outPath}`);
}

(async () => {
  console.log('Generating mock PDFs...');
  await generateUniPdfs();
  await generateDiplomaPdfs();
  await generateDemoTranscript();
  console.log('Done.');
})();
