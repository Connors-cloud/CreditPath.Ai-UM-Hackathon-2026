import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { findByStudentId as findAnalyses, findById as findAnalysis } from '../../models/analysisModel.js';
import { findByStudentId as findApplications, findById as findApplication, findItemsByApplicationId } from '../../models/applicationModel.js';
import { createApplicationFromAnalysis } from '../../services/applicationService.js';
import { getDb } from '../../db/connection.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

router.get('/analyses', (req, res, next) => {
  try {
    const result = findAnalyses(req.user.id);
    res.json({ analyses: result.data });
  } catch (err) { next(err); }
});

router.get('/analyses/:id', (req, res, next) => {
  try {
    const result = findAnalysis(req.params.id);
    if (!result.data || result.data.student_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Analysis not found: analysis_id=${req.params.id}` } });
    }
    const row = result.data;
    res.json({
      analysis: {
        ...row,
        result: row.result_json ? JSON.parse(row.result_json) : null,
        strategies: row.strategies_json ? JSON.parse(row.strategies_json) : null
      }
    });
  } catch (err) { next(err); }
});

router.post('/applications', (req, res, next) => {
  try {
    const { analysis_id, chosen_strategy_index } = req.body;
    if (!analysis_id || chosen_strategy_index === undefined) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'analysis_id and chosen_strategy_index required' } });
    }
    const result = createApplicationFromAnalysis({
      studentId: req.user.id,
      analysisId: analysis_id,
      chosenStrategyIndex: Number(chosen_strategy_index)
    });
    if (!result.ok) return res.status(400).json({ error: { code: 'CREATE_FAILED', message: result.error } });
    res.status(201).json({ application_id: result.data.applicationId });
  } catch (err) { next(err); }
});

router.get('/applications', (req, res, next) => {
  try {
    const result = findApplications(req.user.id);
    res.json({ applications: result.data });
  } catch (err) { next(err); }
});

router.get('/applications/:id', (req, res, next) => {
  try {
    const appResult = findApplication(req.params.id);
    if (!appResult.data || appResult.data.student_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Application not found: application_id=${req.params.id}` } });
    }
    const db = getDb();

    const verdictMap = {};
    if (appResult.data.analysis_id) {
      const analysisRow = db.prepare('SELECT result_json FROM analyses WHERE id = ?').get(appResult.data.analysis_id);
      if (analysisRow?.result_json) {
        try {
          const result = JSON.parse(analysisRow.result_json);
          for (const v of (result.llmVerdicts || [])) {
            const key = v.uniCode;
            if (!verdictMap[key] || v.final_coverage_percent > verdictMap[key].final_coverage_percent) {
              verdictMap[key] = v;
            }
          }
        } catch { /* ignore */ }
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
        lecturer_note: item.lecturer_note || ''
      };
    });

    res.json({ application: appResult.data, items });
  } catch (err) { next(err); }
});

export { router as studentRouter };
