import React, { useRef, useState } from 'react';
import styles from './FileDropzone.module.css';

export default function FileDropzone({ onFiles, accept = '.pdf', multiple = false, label = 'Drop PDF files here or click to browse' }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handle = (files) => {
    const arr = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.zip'));
    if (arr.length) onFiles(arr);
  };

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} onChange={e => handle(e.target.files)} />
      <div className={styles.icon}>📄</div>
      <p className={styles.label}>{label}</p>
      <p className={styles.hint}>PDF files only • Max 20 MB each</p>
    </div>
  );
}
