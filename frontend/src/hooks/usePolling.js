import { useEffect, useRef } from 'react';

/**
 * Run a callback on a fixed interval while mounted.
 * @param {Function} callback
 * @param {number} intervalMs
 * @param {boolean} [enabled=true]
 */
export function usePolling(callback, intervalMs, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => cbRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
