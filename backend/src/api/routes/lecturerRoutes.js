import { Router } from 'express';
import { createReadStream } from 'node:fs';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { findByFilters, findById, findItemsByApplicationId } from '../../models/applicationModel.js';
import { search, findByCode } from '../../models/diplomaSubjectModel.js';
import { recordItemDecision, finalizeApplication } from '../../services/applicationService.js';
import { generateReport } from '../../services/reportService.js';
import { getDb } from '../../db/connection.js';

const router = Router();
router.use(requireAuth, requireRole('lecturer'));

router.get('/applications', (req, res, next) => {
  try {
    const { status, programme_id } = req.query;
    const result = findByFilters({ status, programme_id });
    res.json({ applications: result.data });
  } catch (err) { next(err); }
});

router.get('/applications/:id', (req, res, next) => {
  try {
    const appResult = findById(req.params.id);
    if (!appResult.data) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Application not found: application_id=${req.params.id}` } });
    }
    const db = getDb();

    // Pull full LLM verdicts from the linked analysis result_json
    const verdictMap = {};
    if (appResult.data.analysis_id) {
      const analysisRow = db.prepare('SELECT result_json FROM analyses WHERE id = ?').get(appResult.data.analysis_id);
      if (analysisRow?.result_json) {
        try {
          const result = JSON.parse(analysisRow.result_json);
          for (const v of (result.llmVerdicts || [])) {
            const key = v.uniCode;
            // Keep the verdict with highest coverage if multiple exist for same uni subject
            if (!verdictMap[key] || v.final_coverage_percent > verdictMap[key].final_coverage_percent) {
              verdictMap[key] = v;
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    const rawItems = findItemsByApplicationId(req.params.id).data || [];
    const items = rawItems.map(item => {
      const verdict = verdictMap[item.uni_subject_code];
      const diplomaCodes = verdict?.diplomaCodes
        || (() => { try { return JSON.parse(item.diploma_subject_codes_json); } catch { return []; } })();
      const uniSubj = db.prepare('SELECT name, credit FROM uni_subjects WHERE code = ?').get(item.uni_subject_code);
      return {
        id: item.id,
        application_id: item.application_id,
        uni_subject_code: item.uni_subject_code,
        uni_subject_name: uniSubj?.name || '',
        credits: uniSubj?.credit || 0,
        diploma_subject_codes: Array.isArray(diplomaCodes) ? diplomaCodes.join(',') : diplomaCodes,
        claim_type: item.claim_type,
        coverage_percent: verdict?.final_coverage_percent ?? item.agent_coverage_percent,
        decision: item.lecturer_decision || 'pending',
        lecturer_note: item.lecturer_note || '',
        agent_reason: verdict?.reason || item.agent_reason || '',
        matched_topics: verdict?.matched || [],
        unmatched_topics: verdict?.unmatched || []
      };
    });
    res.json({ application: appResult.data, items });
  } catch (err) { next(err); }
});

router.post('/applications/:id/items/:item_id/decision', (req, res, next) => {
  try {
    const { decision, note } = req.body;
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: { code: 'INVALID_DECISION', message: 'decision must be "approved" or "rejected"' } });
    }
    const result = recordItemDecision({
      applicationId: req.params.id,
      itemId: req.params.item_id,
      decision,
      note: note || '',
      lecturerId: req.user.id
    });
    if (!result.ok) return res.status(400).json({ error: { code: 'DECISION_FAILED', message: result.error } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/applications/:id/finalize', (req, res, next) => {
  try {
    const result = finalizeApplication({ applicationId: req.params.id, lecturerId: req.user.id });
    if (!result.ok) return res.status(400).json({ error: { code: 'FINALIZE_FAILED', message: result.error } });
    res.json({ ok: true, status: result.data.status });
  } catch (err) { next(err); }
});

router.get('/applications/:id/report', async (req, res, next) => {
  try {
    const appResult = findById(req.params.id);
    if (!appResult.data) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Application not found` } });
    }
    const analysisId = appResult.data.analysis_id;
    if (!analysisId) {
      return res.status(404).json({ error: { code: 'NO_ANALYSIS', message: 'No analysis linked to this application' } });
    }
    await generateReport({ analysisId, res });
  } catch (err) { next(err); }
});

router.get('/analyses/:id', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Analysis not found: analysis_id=${req.params.id}` } });
    res.json({
      analysis: {
        ...row,
        result: row.result_json ? JSON.parse(row.result_json) : null,
        strategies: row.strategies_json ? JSON.parse(row.strategies_json) : null
      }
    });
  } catch (err) { next(err); }
});

router.get('/syllabus/search', (req, res, next) => {
  try {
    const { q, institution, code } = req.query;
    const result = search({ q, institution, code });
    res.json({ subjects: result.data });
  } catch (err) { next(err); }
});

router.get('/syllabus/:code', (req, res, next) => {
  try {
    const result = findByCode(req.params.code);
    if (!result.data) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Diploma subject not found: code=${req.params.code}` } });
    }
    const subj = result.data;
    res.json({
      subject: {
        ...subj,
        topics: JSON.parse(subj.topics_json),
        references: JSON.parse(subj.references_json)
      }
    });
  } catch (err) { next(err); }
});

router.get('/syllabus/:code/pdf', (req, res, next) => {
  try {
    const result = findByCode(req.params.code);
    if (!result.data?.pdf_path) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `PDF not found for code=${req.params.code}` } });
    }
    res.setHeader('Content-Type', 'application/pdf');
    createReadStream(result.data.pdf_path).pipe(res);
  } catch (err) { next(err); }
});

export { router as lecturerRouter };
