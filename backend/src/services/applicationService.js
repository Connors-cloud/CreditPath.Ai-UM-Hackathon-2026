import { log } from '../utils/logger.js';
import { newId } from '../utils/ids.js';
import { findById as findAnalysis } from '../models/analysisModel.js';
import {
  createApplication, findById, findItemsByApplicationId,
  createItems, updateApplication, updateItemDecision, findByStudentId
} from '../models/applicationModel.js';
import { createNotification } from '../models/notificationModel.js';
import { writeLog } from '../models/auditLogModel.js';

const MODULE = 'applicationService';

/**
 * Create an application from a completed analysis.
 * @param {{ studentId: string, analysisId: string, chosenStrategyIndex: number }} params
 * @returns {{ ok: boolean, data?: { applicationId: string } }}
 */
export function createApplicationFromAnalysis({ studentId, analysisId, chosenStrategyIndex }) {
  const fn = 'createApplicationFromAnalysis';
  try {
    log.info({ module: MODULE, fn, studentId, analysisId, chosenStrategyIndex }, 'Creating application');

    const analysisResult = findAnalysis(analysisId);
    if (!analysisResult.data) throw new Error(`Analysis not found: analysis_id=${analysisId}`);

    const analysis = analysisResult.data;
    if (analysis.student_id !== studentId) throw new Error(`Forbidden: analysis_id=${analysisId} belongs to another student`);
    if (analysis.status !== 'complete') throw new Error(`Analysis not complete: status=${analysis.status}, analysis_id=${analysisId}`);

    const strategies = JSON.parse(analysis.strategies_json || '{}');
    const strategy = strategies.strategies?.[chosenStrategyIndex];
    if (!strategy) throw new Error(`Strategy index ${chosenStrategyIndex} not found in analysis_id=${analysisId}`);

    const appId = newId();
    const now = Date.now();

    createApplication({
      id: appId,
      student_id: studentId,
      analysis_id: analysisId,
      target_programme_id: analysis.target_programme_id,
      chosen_strategy_index: chosenStrategyIndex,
      strategy_json: JSON.stringify(strategy),
      status: 'submitted',
      submitted_at: now,
      last_updated_at: now,
      last_student_activity_at: now
    });

    // Create application items from chosen strategy's claims
    const items = (strategy.claims || []).map(claim => ({
      id: newId(),
      application_id: appId,
      uni_subject_code: claim.uni_subject_code,
      diploma_subject_codes_json: JSON.stringify(claim.diploma_subject_codes),
      claim_type: claim.claim_type,
      agent_verdict: 'approved',
      agent_reason: `AI analysis: ${claim.coverage_percent}% topic coverage. Transfer recommended.`,
      agent_coverage_percent: claim.coverage_percent
    }));
    if (items.length) createItems(items);

    // Notify lecturer
    createNotification({
      id: newId(),
      user_id: 'user-demo-lecturer',
      type: 'application_received',
      payload_json: JSON.stringify({ application_id: appId, student_id: studentId, strategy_label: strategy.label }),
      created_at: now
    });

    writeLog({ id: newId(), user_id: studentId, action: 'application_submitted', entity_type: 'application', entity_id: appId, metadata_json: null, created_at: now });
    return { ok: true, data: { applicationId: appId } };
  } catch (err) {
    log.error({ module: MODULE, fn, studentId, analysisId, err }, 'Failed to create application');
    return { ok: false, error: err.message };
  }
}

/**
 * Record a lecturer decision on a single application item.
 * @param {{ applicationId: string, itemId: string, decision: string, note: string, lecturerId: string }} params
 * @returns {{ ok: boolean }}
 */
export function recordItemDecision({ applicationId, itemId, decision, note, lecturerId }) {
  const fn = 'recordItemDecision';
  try {
    log.info({ module: MODULE, fn, applicationId, itemId, decision }, 'Recording item decision');
    const now = Date.now();
    updateItemDecision(itemId, { lecturer_decision: decision, lecturer_note: note || null, decided_at: now, decided_by: lecturerId });
    updateApplication(applicationId, { last_updated_at: now });
    writeLog({ id: newId(), user_id: lecturerId, action: `item_${decision}`, entity_type: 'application_item', entity_id: itemId, metadata_json: JSON.stringify({ note }), created_at: now });
    return { ok: true };
  } catch (err) {
    log.error({ module: MODULE, fn, itemId, err }, 'Failed to record item decision');
    return { ok: false, error: err.message };
  }
}

/**
 * Finalize an application: compute overall status, notify student.
 * @param {{ applicationId: string, lecturerId: string }} params
 * @returns {{ ok: boolean }}
 */
export function finalizeApplication({ applicationId, lecturerId }) {
  const fn = 'finalizeApplication';
  try {
    log.info({ module: MODULE, fn, applicationId }, 'Finalizing application');

    const appResult = findById(applicationId);
    if (!appResult.data) throw new Error(`Application not found: application_id=${applicationId}`);

    const items = findItemsByApplicationId(applicationId).data || [];
    const allDecided = items.every(i => i.lecturer_decision === 'approved' || i.lecturer_decision === 'rejected');
    if (!allDecided) throw new Error(`Not all items have decisions: application_id=${applicationId}`);

    const allApproved = items.every(i => i.lecturer_decision === 'approved');
    const allRejected = items.every(i => i.lecturer_decision === 'rejected');
    const finalStatus = allApproved ? 'approved' : allRejected ? 'rejected' : 'partial';

    const now = Date.now();
    updateApplication(applicationId, { status: finalStatus, last_updated_at: now });

    createNotification({
      id: newId(),
      user_id: appResult.data.student_id,
      type: 'decision_made',
      payload_json: JSON.stringify({ application_id: applicationId, status: finalStatus }),
      created_at: now
    });

    writeLog({ id: newId(), user_id: lecturerId, action: 'application_finalized', entity_type: 'application', entity_id: applicationId, metadata_json: JSON.stringify({ status: finalStatus }), created_at: now });
    return { ok: true, data: { status: finalStatus } };
  } catch (err) {
    log.error({ module: MODULE, fn, applicationId, err }, 'Failed to finalize application');
    return { ok: false, error: err.message };
  }
}
