import React, { useState } from 'react';
import styles from './StrategyCards.module.css';

export default function StrategyCards({ strategies, recommendation, onSelect, selectedIndex }) {
  if (!strategies?.length) return null;

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Transfer Strategies</h3>
      {recommendation && <p className={styles.rec}>{recommendation}</p>}
      <div className={styles.grid}>
        {strategies.map((s, idx) => (
          <div
            key={idx}
            className={`${styles.card} ${selectedIndex === idx ? styles.selected : ''}`}
            onClick={() => onSelect?.(idx)}
          >
            <div className={styles.label}>{s.label}</div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statVal}>{s.total_credits_transferred}</span>
                <span className={styles.statLbl}>credits</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statVal}>{s.uni_subjects_transferred_count}</span>
                <span className={styles.statLbl}>subjects</span>
              </div>
            </div>
            <p className={styles.explanation}>{s.explanation}</p>
            <div className={styles.claims}>
              {(s.claims || []).map((c, ci) => (
                <div key={ci} className={styles.claim}>
                  <span className={styles.claimCode}>{c.uni_subject_code}</span>
                  <span className={styles.claimDiploma}>← {c.diploma_subject_codes.join(' + ')}</span>
                  <span className={styles.claimCov}>{c.coverage_percent}%</span>
                  <span className={`badge ${c.claim_type === 'standalone' ? 'badge-success' : 'badge-primary'}`}>{c.claim_type}</span>
                </div>
              ))}
            </div>
            {onSelect && (
              <button className={`btn-primary ${styles.btn}`} onClick={() => onSelect(idx)}>
                {selectedIndex === idx ? '✓ Selected' : 'Select this strategy'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
