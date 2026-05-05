import { getDb } from '../db/connection.js';
import { log } from '../utils/logger.js';
import { hashParts } from '../utils/hash.js';
import { matchTopics, buildTopicPool } from '../matching/titleMatcher.js';
import { gradesAllMeetMinimum } from '../matching/gradeChecker.js';
import { optimizeAssignment } from '../optimizer/assignmentOptimizer.js';
import { callLlmJson, callLlmWithTools } from '../llm/zaiClient.js';
import { buildLecturerPrompt } from '../llm/lecturerPrompt.js';
import { buildStrategistPrompt, optimizerToolDefinition } from '../llm/strategistPrompt.js';
import { lecturerVerdictSchema, strategistResponseSchema } from '../llm/schemas.js';
import { emitEvent, removeEmitter } from './sseStream.js';
import { findById as findAnalysis, updateAnalysis } from '../models/analysisModel.js';
import { findByKey, upsert as cacheUpsert } from '../models/matchCacheModel.js';

const MODULE = 'analysisOrchestrator';
const EDGE_MIN = 60; // minimum raw coverage to call LLM

/**
 * Run the full 5-phase analysis pipeline for an analysis record.
 * Emits SSE events via sseStream. Updates analyses table incrementally.
 * @param {string} analysisId
 * @returns {Promise<void>}
 */
export async function runAnalysis(analysisId) {
  const fn = 'runAnalysis';
  log.info({ module: MODULE, fn, analysisId }, 'Starting analysis pipeline');

  try {
    await _runPipeline(analysisId);
  } catch (err) {
    log.error({ module: MODULE, fn, analysisId, err }, 'Analysis pipeline failed');
    updateAnalysis(analysisId, {
      status: 'failed',
      error_message: err.message,
      completed_at: Date.now()
    });
    emitEvent(analysisId, 'error', { message: err.message });
    removeEmitter(analysisId);
  }
}

async function _runPipeline(analysisId) {
  const db = getDb();
  const analysisRow = findAnalysis(analysisId).data;
  if (!analysisRow) throw new Error(`Analysis not found: analysis_id=${analysisId}`);

  updateAnalysis(analysisId, { status: 'running' });

  // ── Phase 0: Load data ──────────────────────────────────────────────────────
  emitEvent(analysisId, 'phase_start', { phase: 0, message: 'Loading student data...' });

  const entries = db.prepare(
    `SELECT te.* FROM transcript_entries te
     JOIN transcripts t ON t.id = te.transcript_id
     WHERE t.student_id = ? ORDER BY te.subject_code`
  ).all(analysisRow.student_id);

  const gradeMap = {};
  for (const e of entries) gradeMap[e.subject_code] = e.grade;

  const syllabusIds = analysisRow.syllabus_ids_json
    ? JSON.parse(analysisRow.syllabus_ids_json)
    : [];

  // Step 1: collect diploma codes from uploaded syllabi (parsed subject_code field)
  let syllabusParsedCodes = [];
  if (syllabusIds.length) {
    const ph = syllabusIds.map(() => '?').join(',');
    const syllabi = db.prepare(`SELECT subject_code FROM uploaded_syllabi WHERE id IN (${ph})`).all(...syllabusIds);
    syllabusParsedCodes = syllabi.map(s => s.subject_code).filter(Boolean);
  }

  // Step 2: also include any diploma codes that appear directly in the student's transcript
  // (handles case where syllabus PDFs couldn't be parsed but transcript has matching codes)
  const allSeededCodes = new Set(db.prepare('SELECT code FROM diploma_subjects').all().map(d => d.code));
  const transcriptDiplomaCodes = Object.keys(gradeMap).filter(c => allSeededCodes.has(c));

  // Merge: syllabi codes + transcript-matched codes, deduplicated
  let diplomaCodes = [...new Set([...syllabusParsedCodes, ...transcriptDiplomaCodes])];

  // Step 3: if still empty (no syllabi parsed AND no transcript entries matched), use ALL seeded subjects
  if (!diplomaCodes.length) {
    diplomaCodes = [...allSeededCodes];
    log.warn({ module: MODULE, analysisId }, 'No diploma codes resolved — falling back to all seeded diploma subjects');
  }

  const ph2 = diplomaCodes.map(() => '?').join(',');
  const diplomaSubjects = db.prepare(`SELECT * FROM diploma_subjects WHERE code IN (${ph2})`).all(...diplomaCodes);

  // Step 4: attach grades; if transcript had no entries, assign default passing grade
  const studentDiploma = entries.length > 0
    ? diplomaSubjects.filter(d => gradeMap[d.code] !== undefined).map(d => ({ ...d, grade: gradeMap[d.code] }))
    : diplomaSubjects.map(d => ({ ...d, grade: 'B' }));

  const uniSubjects = db.prepare('SELECT * FROM uni_subjects WHERE programme_id = ?').all(analysisRow.target_programme_id);

  log.info({ module: MODULE, fn: '_runPipeline', analysisId, uniCount: uniSubjects.length, diplomaCount: studentDiploma.length }, 'Phase 0 complete');

  // ── Phase 1+2: Deterministic matching ──────────────────────────────────────
  emitEvent(analysisId, 'phase_start', { phase: 1, message: `Matching topics across ${uniSubjects.length} university subjects...` });

  const phase12Results = [];

  for (const uni of uniSubjects) {
    const uniTopics = JSON.parse(uni.topics_json);

    // Standalone
    for (const dipl of studentDiploma) {
      const { rawCoveragePercent, matched, unmatched } = matchTopics(uniTopics, JSON.parse(dipl.topics_json));
      const gradePassed = gradesAllMeetMinimum([dipl.grade]);
      if (rawCoveragePercent >= EDGE_MIN || rawCoveragePercent >= 80) {
        phase12Results.push({
          uniCode: uni.code, uniName: uni.name, uniCredits: uni.credit,
          diplomaCodes: [dipl.code], claimType: 'standalone',
          matched, unmatched, rawCoveragePercent, gradePassed,
          grades: { [dipl.code]: dipl.grade }
        });
      }
    }

    // Combos — only enumerate where standalone coverage < 80% (optimise)
    const standalonePassCodes = new Set(
      studentDiploma
        .filter(d => {
          const { rawCoveragePercent } = matchTopics(uniTopics, JSON.parse(d.topics_json));
          return rawCoveragePercent >= 80;
        })
        .map(d => d.code)
    );

    if (standalonePassCodes.size === 0) {
      for (let i = 0; i < studentDiploma.length; i++) {
        for (let j = i + 1; j < studentDiploma.length; j++) {
          const d1 = studentDiploma[i], d2 = studentDiploma[j];
          const pool = buildTopicPool([d1, d2]);
          const { rawCoveragePercent, matched, unmatched } = matchTopics(uniTopics, pool);
          const gradePassed = gradesAllMeetMinimum([d1.grade, d2.grade]);
          if (rawCoveragePercent >= 80 && gradePassed) {
            phase12Results.push({
              uniCode: uni.code, uniName: uni.name, uniCredits: uni.credit,
              diplomaCodes: [d1.code, d2.code], claimType: 'combo',
              matched, unmatched, rawCoveragePercent, gradePassed,
              grades: { [d1.code]: d1.grade, [d2.code]: d2.grade }
            });
          }
        }
      }
    }
  }

  updateAnalysis(analysisId, { result_json: JSON.stringify({ phase: 2, phase12Results }) });

  // ── Phase 3: LLM Lecturer ───────────────────────────────────────────────────
  emitEvent(analysisId, 'phase_start', { phase: 3, message: 'AI reviewing subject equivalences...' });

  const llmVerdicts = [];
  const processedUni = new Set();

  // Deduplicate: process each (uniCode, diplomaCodes) pair only once
  const uniquePairs = deduplicatePairs(phase12Results);

  for (const candidate of uniquePairs) {
    const cacheKey = hashParts([candidate.uniCode, ...candidate.diplomaCodes.sort()]);
    const cached = findByKey(cacheKey).data;

    if (cached) {
      const verdict = JSON.parse(cached.llm_verdict_json);
      llmVerdicts.push({ ...candidate, ...verdict, fromCache: true });
      emitEvent(analysisId, 'lecturer_verdict', {
        uni_code: candidate.uniCode,
        diploma_codes: candidate.diplomaCodes,
        verdict: verdict.verdict,
        coverage: verdict.final_coverage_percent,
        reason: verdict.reason,
        fromCache: true
      });
      processedUni.add(candidate.uniCode);
      continue;
    }

    // Emit thinking event
    emitEvent(analysisId, 'lecturer_thinking', {
      uni_code: candidate.uniCode,
      diploma_codes: candidate.diplomaCodes,
      partial_text: `Evaluating ${candidate.uniName} ← ${candidate.diplomaCodes.join(' + ')}...`
    });

    // Build prompt inputs
    const uniRow = db.prepare('SELECT * FROM uni_subjects WHERE code = ? AND programme_id = ?').get(candidate.uniCode, analysisRow.target_programme_id);
    const diplomaRows = db.prepare(`SELECT * FROM diploma_subjects WHERE code IN (${candidate.diplomaCodes.map(() => '?').join(',')})`)
      .all(...candidate.diplomaCodes)
      .map(d => ({ ...d, grade: candidate.grades[d.code] }));

    const { systemPrompt, userPrompt } = buildLecturerPrompt({
      uni: uniRow,
      diploma: diplomaRows,
      phase1: {
        matched: candidate.matched,
        unmatched: candidate.unmatched,
        rawCoveragePercent: candidate.rawCoveragePercent,
        gradePassed: candidate.gradePassed
      }
    });

    let verdict;
    try {
      verdict = await callLlmJson({ systemPrompt, userPrompt, schema: lecturerVerdictSchema });
    } catch (err) {
      log.error({ module: MODULE, analysisId, uniCode: candidate.uniCode, err }, 'LLM call failed, using deterministic fallback');
      verdict = buildFallbackVerdict(candidate);
    }

    if (!verdict) verdict = buildFallbackVerdict(candidate);

    // Cache it
    cacheUpsert({
      cache_key: cacheKey,
      uni_subject_code: candidate.uniCode,
      diploma_subject_codes_json: JSON.stringify(candidate.diplomaCodes),
      phase1_result_json: JSON.stringify({ matched: candidate.matched, unmatched: candidate.unmatched, rawCoveragePercent: candidate.rawCoveragePercent }),
      llm_verdict_json: JSON.stringify(verdict),
      created_at: Date.now()
    });

    llmVerdicts.push({ ...candidate, ...verdict, fromCache: false });
    processedUni.add(candidate.uniCode);

    emitEvent(analysisId, 'lecturer_verdict', {
      uni_code: candidate.uniCode,
      uni_name: candidate.uniName,
      diploma_codes: candidate.diplomaCodes,
      verdict: verdict.verdict,
      coverage: verdict.final_coverage_percent,
      reason: verdict.reason,
      missed_topics: verdict.missed_topics
    });
  }

  updateAnalysis(analysisId, { result_json: JSON.stringify({ phase: 3, llmVerdicts }) });

  // ── Phase 4: Strategist ─────────────────────────────────────────────────────
  emitEvent(analysisId, 'phase_start', { phase: 4, message: 'Planning optimal transfer strategies...' });

  const qualifiedVerdicts = llmVerdicts.filter(v =>
    v.verdict === 'approved' || v.verdict === 'edge_case_approved'
  );

  const { systemPrompt: sysP, userPrompt: usrP } = buildStrategistPrompt({
    verdicts: llmVerdicts,
    studentPriorities: analysisRow.prompt_text || 'Maximise transferable credits'
  });

  const diplomatMap = Object.fromEntries(studentDiploma.map(d => [d.code, d]));

  const toolHandlers = {
    run_optimizer: ({ qualified_claims }) => {
      const result = optimizeAssignment(qualified_claims);
      return result;
    }
  };

  let strategiesJson;
  try {
    const rawResponse = await callLlmWithTools({
      systemPrompt: sysP,
      userPrompt: usrP,
      tools: [optimizerToolDefinition],
      toolHandlers
    });
    const parsed = JSON.parse(rawResponse);
    const validated = strategistResponseSchema.safeParse(parsed);
    strategiesJson = validated.success ? validated.data : buildFallbackStrategies(qualifiedVerdicts, diplomatMap);
  } catch (err) {
    log.error({ module: MODULE, analysisId, err }, 'Strategist LLM failed, using fallback');
    strategiesJson = buildFallbackStrategies(qualifiedVerdicts, diplomatMap);
  }

  emitEvent(analysisId, 'strategist_plans', { strategies: strategiesJson.strategies, recommendation: strategiesJson.recommendation });

  updateAnalysis(analysisId, {
    status: 'complete',
    result_json: JSON.stringify({ phase: 4, llmVerdicts }),
    strategies_json: JSON.stringify(strategiesJson),
    completed_at: Date.now()
  });

  emitEvent(analysisId, 'analysis_complete', { analysis_id: analysisId });
  removeEmitter(analysisId);
  log.info({ module: MODULE, fn: '_runPipeline', analysisId }, 'Analysis pipeline complete');
}

/** Deduplicate phase12Results: for each (uniCode, sorted diplomaCodes) keep best coverage. */
function deduplicatePairs(results) {
  const seen = new Map();
  for (const r of results) {
    const key = r.uniCode + '|' + r.diplomaCodes.slice().sort().join(',');
    const existing = seen.get(key);
    if (!existing || r.rawCoveragePercent > existing.rawCoveragePercent) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

/** Deterministic fallback verdict when LLM is unavailable. */
function buildFallbackVerdict(candidate) {
  const passes = candidate.rawCoveragePercent >= 80 && candidate.gradePassed;
  return {
    verdict: passes ? 'approved' : 'rejected',
    final_coverage_percent: candidate.rawCoveragePercent,
    rule_check: { meets_80_percent: candidate.rawCoveragePercent >= 80, meets_grade_c: candidate.gradePassed },
    exact_matches: candidate.matched,
    additional_matches_found: [],
    missed_topics: candidate.unmatched,
    reference_overlap: 'unknown',
    reason: passes
      ? `Deterministic analysis: ${candidate.rawCoveragePercent}% topic coverage with passing grade. Transfer approved.`
      : `Deterministic analysis: ${candidate.rawCoveragePercent}% topic coverage (minimum 80% required). Missing: ${candidate.unmatched.slice(0, 3).join(', ')}.`,
    edge_case_notes: null
  };
}

/** Build fallback strategies from qualified verdicts without LLM. */
function buildFallbackStrategies(qualifiedVerdicts, diplomatMap) {
  const claims = qualifiedVerdicts.map(v => ({
    uniSubjectCode: v.uniCode,
    uniSubjectName: v.uniName,
    diplomaSubjectCodes: v.diplomaCodes,
    credits: v.uniCredits,
    coveragePercent: v.final_coverage_percent
  }));

  const maxResult = optimizeAssignment(claims);
  const conservativeClaims = qualifiedVerdicts
    .filter(v => v.verdict === 'approved')
    .map(v => ({ uniSubjectCode: v.uniCode, uniSubjectName: v.uniName, diplomaSubjectCodes: v.diplomaCodes, credits: v.uniCredits, coveragePercent: v.final_coverage_percent }));
  const conservativeResult = optimizeAssignment(conservativeClaims);

  const toStrategy = (label, result, explanation) => ({
    label,
    claims: result.selected.map(c => ({
      uni_subject_code: c.uniSubjectCode,
      uni_subject_name: c.uniSubjectName,
      diploma_subject_codes: c.diplomaSubjectCodes,
      claim_type: c.diplomaSubjectCodes.length === 1 ? 'standalone' : 'combo',
      credits_earned: c.credits,
      coverage_percent: c.coveragePercent
    })),
    total_credits_transferred: result.totalCredits,
    uni_subjects_transferred_count: result.selected.length,
    diploma_subjects_used_count: new Set(result.selected.flatMap(c => c.diplomaSubjectCodes)).size,
    explanation
  });

  return {
    strategies: [
      toStrategy('Maximum Credits', maxResult, `Transfers ${maxResult.totalCredits} credits across ${maxResult.selected.length} subjects, including borderline AI-approved cases.`),
      toStrategy('Conservative', conservativeResult, `Transfers ${conservativeResult.totalCredits} credits using only clearly approved cases, avoiding all borderline decisions.`)
    ],
    recommendation: `Strategy A maximises your credit transfer at ${maxResult.totalCredits} credits. Choose Strategy B if you prefer only definitive approvals.`
  };
}
