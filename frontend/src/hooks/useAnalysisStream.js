import { useState, useEffect, useRef } from 'react';

/**
 * Connect to the SSE stream for an analysis and return live state.
 * @param {string|null} analysisId
 * @returns {{ phase: number, thinkingMap: object, verdicts: object[], strategies: object[]|null, recommendation: string, isComplete: boolean, error: string|null }}
 */
export function useAnalysisStream(analysisId) {
  const [phase, setPhase] = useState(0);
  const [thinkingMap, setThinkingMap] = useState({});   // uniCode → partial text
  const [verdicts, setVerdicts] = useState([]);
  const [strategies, setStrategies] = useState(null);
  const [recommendation, setRecommendation] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    if (!analysisId) return;

    const token = localStorage.getItem('auth_token');
    const url = `/api/analyses/${analysisId}/stream?token=${encodeURIComponent(token || '')}`;
    const es = new EventSource(url);
    esRef.current = es;

    const on = (type, handler) => es.addEventListener(type, (e) => {
      try { handler(JSON.parse(e.data)); } catch { /* ignore parse errors */ }
    });

    on('phase_start', ({ phase: p }) => setPhase(p));

    on('lecturer_thinking', ({ uni_code, partial_text }) => {
      setThinkingMap(m => ({ ...m, [uni_code]: (m[uni_code] || '') + partial_text }));
    });

    on('lecturer_verdict', (v) => {
      setVerdicts(prev => {
        const existing = prev.findIndex(x => x.uni_code === v.uni_code && JSON.stringify(x.diploma_codes) === JSON.stringify(v.diploma_codes));
        if (existing >= 0) { const n = [...prev]; n[existing] = v; return n; }
        return [...prev, v];
      });
    });

    on('strategist_plans', ({ strategies: s, recommendation: r }) => {
      setStrategies(s);
      setRecommendation(r || '');
    });

    on('analysis_complete', () => {
      setIsComplete(true);
      es.close();
    });

    on('error', ({ message }) => {
      setError(message);
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setError('Connection lost. The analysis may still be running — please refresh.');
      es.close();
    };

    return () => { es.close(); };
  }, [analysisId]);

  return { phase, thinkingMap, verdicts, strategies, recommendation, isComplete, error };
}
