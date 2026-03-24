// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingRecoveryPanel  (Sprint 10)
// Slide-in panel for browsing saved drawing versions and restoring.
// Accessible from Drawing Tools menu or context menu.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { listVersions, recoverDrawings, getSessionSnapshot } from '../../../../charting_library/tools/DrawingPersistence.js';
import s from './DrawingRecoveryPanel.module.css';

export default function DrawingRecoveryPanel({ open, onClose, symbol, timeframe, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listVersions(symbol, timeframe)
      .then(v => setVersions(v.reverse())) // newest first
      .finally(() => setLoading(false));
  }, [open, symbol, timeframe]);

  const handleRestore = useCallback(async (versionIndex) => {
    setRestoring(versionIndex);
    const drawings = await recoverDrawings(symbol, timeframe, versionIndex);
    if (drawings.length > 0) {
      onRestore(drawings);
    }
    setRestoring(null);
    onClose();
  }, [symbol, timeframe, onRestore, onClose]);

  const handleSessionRevert = useCallback(() => {
    const snapshot = getSessionSnapshot();
    if (snapshot) {
      onRestore(snapshot);
      onClose();
    }
  }, [onRestore, onClose]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
  };

  if (!open) return null;

  return (
    <div onClick={onClose} className={s.backdrop}>
      <div onClick={(e) => e.stopPropagation()} className={s.dialog}>
        {/* Header */}
        <div className={s.header}>
          <div>
            <div className={s.headerTitle}>Drawing Recovery</div>
            <div className={s.headerSub}>{symbol} · {timeframe}</div>
          </div>
          <button onClick={onClose} className={s.closeBtn}>✕</button>
        </div>

        {/* Session revert */}
        {getSessionSnapshot() && (
          <div className={s.sessionRevert}>
            <button onClick={handleSessionRevert} className={s.revertBtn}>
              <span>↺</span>
              Undo all changes this session
            </button>
          </div>
        )}

        {/* Version list */}
        <div className={s.versionList}>
          {loading ? (
            <div className={s.emptyState}>Loading versions…</div>
          ) : versions.length === 0 ? (
            <div className={s.emptyState}>No saved versions found</div>
          ) : (
            versions.map((v) => (
              <div key={v.index} className={s.versionRow}>
                <div>
                  <div className={s.versionTime}>{formatTime(v.timestamp)}</div>
                  <div className={s.versionCount}>
                    {v.count} drawing{v.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(v.index)}
                  disabled={restoring !== null}
                  className={s.restoreBtn}
                >
                  {restoring === v.index ? '…' : 'Restore'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
