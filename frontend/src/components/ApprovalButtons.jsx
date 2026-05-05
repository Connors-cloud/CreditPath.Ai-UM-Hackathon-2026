import React, { useState } from 'react';
import styles from './ApprovalButtons.module.css';

/**
 * Purely local — calls onStage(decision|null, note) with no API side-effects.
 * Parent batches all decisions and submits together.
 */
export default function ApprovalButtons({ stagedDecision, stagedNote, onStage, disabled }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [note, setNote] = useState(stagedNote || '');
  const [noteError, setNoteError] = useState('');

  const approve = () => {
    setRejectMode(false);
    setNoteError('');
    onStage('approved', '');
  };

  const enterReject = () => {
    setNote(stagedNote || '');
    setRejectMode(true);
  };

  const confirmReject = () => {
    if (!note.trim()) { setNoteError('Reason is required for rejection.'); return; }
    setNoteError('');
    setRejectMode(false);
    onStage('rejected', note.trim());
  };

  const undo = () => {
    setRejectMode(false);
    setNote('');
    setNoteError('');
    onStage(null, '');
  };

  if (stagedDecision === 'approved') {
    return (
      <div className={styles.decided}>
        <span className="badge badge-success">✓ Approved</span>
        <button className="btn-secondary btn-sm" onClick={undo} disabled={disabled}>Change</button>
      </div>
    );
  }

  if (stagedDecision === 'rejected') {
    return (
      <div className={styles.decided}>
        <span className="badge badge-danger">✗ Rejected</span>
        {stagedNote && <span className={styles.notePreview}>"{stagedNote}"</span>}
        <button className="btn-secondary btn-sm" onClick={undo} disabled={disabled}>Change</button>
      </div>
    );
  }

  if (rejectMode) {
    return (
      <div className={styles.rejectWrap}>
        <label className={styles.rejectLabel}>
          Rejection reason <span className={styles.required}>*</span>
        </label>
        <textarea
          className={`${styles.note} ${noteError ? styles.noteErr : ''}`}
          rows={2}
          placeholder="State the reason for rejection..."
          value={note}
          onChange={e => { setNote(e.target.value); setNoteError(''); }}
          autoFocus
        />
        {noteError && <div className={styles.errMsg}>{noteError}</div>}
        <div className={styles.btns}>
          <button className="btn-secondary btn-sm" onClick={() => setRejectMode(false)}>Cancel</button>
          <button className="btn-danger btn-sm" onClick={confirmReject}>Confirm Reject</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.btns}>
        <button className="btn-success btn-sm" disabled={disabled} onClick={approve}>✓ Approve</button>
        <button className="btn-danger btn-sm" disabled={disabled} onClick={enterReject}>✗ Reject</button>
      </div>
    </div>
  );
}
