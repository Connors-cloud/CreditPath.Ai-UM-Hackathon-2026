import { log } from '../utils/logger.js';
import { newId } from '../utils/ids.js';
import { createAnalysis, findById, updateAnalysis } from '../models/analysisModel.js';
import { runAnalysis } from '../agent/analysisOrchestrator.js';

const MODULE = 'analysisService';

/**
 * Create an analysis record and kick off the async pipeline.
 * @param {{ studentId: string, type: string, targetProgrammeId: string, transcriptId: string, syllabusIds: string[], promptText: string }} params
 * @returns {{ ok: boolean, data?: { analysisId: string } }}
 */
export function startAnalysis({ studentId, type, targetProgrammeId, transcriptId, syllabusIds, promptText }) {
  const fn = 'startAnalysis';
  try {
    log.info({ module: MODULE, fn, studentId, targetProgrammeId, type }, 'Starting analysis');
    const id = newId();
    createAnalysis({
      id,
      student_id: studentId,
      type: type || 'credit_transfer',
      target_programme_id: targetProgrammeId,
      status: 'pending',
      prompt_text: promptText || null,
      transcript_id: transcriptId || null,
      syllabus_ids_json: syllabusIds ? JSON.stringify(syllabusIds) : null,
      created_at: Date.now()
    });

    // Run async — do not await
    runAnalysis(id).catch(err => {
      log.error({ module: MODULE, fn, analysisId: id, err }, 'Background analysis failed');
    });

    return { ok: true, data: { analysisId: id } };
  } catch (err) {
    log.error({ module: MODULE, fn, studentId, err }, 'Failed to start analysis');
    return { ok: false, error: err.message };
  }
}

/**
 * Get analysis with parsed result and strategies.
 * @param {string} id
 * @returns {{ ok: boolean, data?: object }}
 */
export function getAnalysis(id) {
  const fn = 'getAnalysis';
  try {
    const result = findById(id);
    if (!result.data) return { ok: false, error: 'Analysis not found' };
    const row = result.data;
    return {
      ok: true,
      data: {
        ...row,
        result: row.result_json ? JSON.parse(row.result_json) : null,
        strategies: row.strategies_json ? JSON.parse(row.strategies_json) : null
      }
    };
  } catch (err) {
    log.error({ module: MODULE, fn, id, err }, 'Failed to get analysis');
    return { ok: false, error: err.message };
  }
}
