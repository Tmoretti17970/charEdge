// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingRecoveryPanel  (Sprint 10)
// Slide-in panel for browsing saved drawing versions and restoring.
// Accessible from Drawing Tools menu or context menu.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { listVersions, recoverDrawings, getSessionSnapshot } from '../../../../charting_library/tools/DrawingPersistence.js';

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'tfDropdownIn 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340, maxHeight: 420, overflow: 'auto',
          borderRadius: 16,
          background: 'rgba(20, 22, 30, 0.96)',
          backdropFilter: 'blur(28px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          color: '#D1D4DC',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Drawing Recovery</div>
            <div style={{ fontSize: 10, color: '#787B86', marginTop: 2 }}>
              {symbol} · {timeframe}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#787B86',
              cursor: 'pointer', fontSize: 16, padding: '4px 8px',
              borderRadius: 6,
            }}
          >✕</button>
        </div>

        {/* Session revert */}
        {getSessionSnapshot() && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <button
              onClick={handleSessionRevert}
              style={{
                width: '100%', padding: '8px 12px',
                borderRadius: 8, border: '1px solid rgba(239,83,80,0.2)',
                background: 'rgba(239,83,80,0.08)', cursor: 'pointer',
                color: '#EF5350', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,83,80,0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,83,80,0.08)'}
            >
              <span>↺</span>
              Undo all changes this session
            </button>
          </div>
        )}

        {/* Version list */}
        <div style={{ padding: '6px 0' }}>
          {loading ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: '#787B86' }}>
              Loading versions…
            </div>
          ) : versions.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: '#787B86' }}>
              No saved versions found
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.index}
                style={{
                  padding: '8px 16px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>
                    {formatTime(v.timestamp)}
                  </div>
                  <div style={{ fontSize: 10, color: '#787B86', marginTop: 1 }}>
                    {v.count} drawing{v.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(v.index)}
                  disabled={restoring !== null}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: '1px solid rgba(41,98,255,0.2)',
                    background: restoring === v.index ? 'rgba(41,98,255,0.2)' : 'rgba(41,98,255,0.08)',
                    color: '#2962FF', fontSize: 11, fontWeight: 600,
                    cursor: restoring !== null ? 'wait' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (restoring === null) e.currentTarget.style.background = 'rgba(41,98,255,0.15)'; }}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(41,98,255,0.08)'}
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
