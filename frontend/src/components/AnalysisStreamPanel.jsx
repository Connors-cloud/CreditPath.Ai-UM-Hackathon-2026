import React from 'react';
import styles from './AnalysisStreamPanel.module.css';

const PHASES = ['Ingestion', 'Topic Matching', 'Grade Check', 'AI Lecturer Review', 'Strategy Planning'];

export default function AnalysisStreamPanel({ phase, thinkingMap, verdicts, isComplete, error }) {
  const currentThinking = Object.entries(thinkingMap);

  return (
    <div className={styles.panel}>
      <div className={styles.phasebar}>
        {PHASES.map((label, i) => (
          <div key={i} className={`${styles.step} ${phase > i ? styles.done : phase === i ? styles.active : ''}`}>
            <div className={styles.dot}>{phase > i ? '✓' : i + 1}</div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!isComplete && !error && (
        <div className={styles.live}>
          <div className={styles.liveLabel}>
            <span className={styles.spinner} />
            AI is reviewing subjects...
          </div>
          {currentThinking.slice(-3).map(([uniCode, text]) => (
            <div key={uniCode} className={styles.bubble}>
              <div className={styles.bubbleCode}>{uniCode}</div>
              <div className={`${styles.bubbleText} cursor-blink`}>{text}</div>
            </div>
          ))}
        </div>
      )}

      {isComplete && <div className={styles.complete}>✓ Analysis complete</div>}
    </div>
  );
}
