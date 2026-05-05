import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { startAnalysis, getAnalysis } from '../../services/analysisService.js';
import { generateReport } from '../../services/reportService.js';
import { attachSse, getEmitter } from '../../agent/sseStream.js';
import { findById } from '../../models/analysisModel.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

router.post('/', (req, res, next) => {
  try {
    const { type, target_programme_id, transcript_id, syllabus_ids, prompt_text } = req.body;
    if (!target_programme_id) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'target_programme_id required' } });
    }
    const result = startAnalysis({
      studentId: req.user.id,
      type: type || 'credit_transfer',
      targetProgrammeId: target_programme_id,
      transcriptId: transcript_id || null,
      syllabusIds: syllabus_ids || [],
      promptText: prompt_text || ''
    });
    if (!result.ok) return res.status(500).json({ error: { code: 'START_FAILED', message: result.error } });
    res.status(201).json({ analysis_id: result.data.analysisId });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stream', (req, res, next) => {
  try {
    const analysisRow = findById(req.params.id).data;
    if (!analysisRow || analysisRow.student_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Analysis not found: analysis_id=${req.params.id}` } });
    }

    // If already complete, replay from stored data
    if (analysisRow.status === 'complete') {
      const strategies = analysisRow.strategies_json ? JSON.parse(analysisRow.strategies_json) : null;
      const replayEvents = [
        { type: 'phase_start', data: { phase: 1, message: 'Analysis already complete — replaying results.' } },
        ...(strategies ? [{ type: 'strategist_plans', data: { strategies: strategies.strategies, recommendation: strategies.recommendation } }] : []),
        { type: 'analysis_complete', data: { analysis_id: req.params.id } }
      ];
      attachSse(req.params.id, res, replayEvents);
      return;
    }

    if (analysisRow.status === 'failed') {
      attachSse(req.params.id, res, [
        { type: 'error', data: { message: analysisRow.error_message || 'Analysis failed' } }
      ]);
      return;
    }

    attachSse(req.params.id, res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/report', async (req, res, next) => {
  try {
    const analysisRow = findById(req.params.id).data;
    if (!analysisRow || analysisRow.student_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Analysis not found` } });
    }
    await generateReport({ analysisId: req.params.id, res });
  } catch (err) {
    next(err);
  }
});

export { router as analysisRouter };
