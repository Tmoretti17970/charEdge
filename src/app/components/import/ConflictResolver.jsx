// ═══════════════════════════════════════════════════════════════════
// charEdge — Conflict Resolver UI (Phase 6 Sprint 6.5)
//
// Side-by-side comparison for handling duplicate/conflicting trades
// during import. Allows user to Keep Existing, Replace, or Skip.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

function ConflictRow({ existing, incoming, onResolve }) {
  const [hovered, setHovered] = useState(false);

  const fields = ['date', 'symbol', 'side', 'quantity', 'price', 'pnl'];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${alpha(C.bd, 0.2)}`,
        background: hovered ? alpha(C.sf, 0.5) : 'transparent',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'start' }}>
        {/* Existing */}
        <div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            Existing
          </div>
          {fields.map((f) => (
            <div key={f} style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t2, marginBottom: 1 }}>
              <span style={{ color: C.t3, fontWeight: 600, width: 60, display: 'inline-block' }}>{f}:</span>
              {existing[f] ?? '—'}
            </div>
          ))}
        </div>

        {/* Incoming */}
        <div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: C.b,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            Incoming
          </div>
          {fields.map((f) => {
            const diff = existing[f] !== incoming[f];
            return (
              <div
                key={f}
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--tf-mono)',
                  color: diff ? C.y : C.t2,
                  fontWeight: diff ? 700 : 400,
                  marginBottom: 1,
                }}
              >
                <span style={{ color: C.t3, fontWeight: 600, width: 60, display: 'inline-block' }}>{f}:</span>
                {incoming[f] ?? '—'}
                {diff && <span style={{ fontSize: 8, color: C.y, marginLeft: 4 }}>⚡</span>}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
          <button
            onClick={() => onResolve('keep')}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${alpha(C.bd, 0.3)}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Keep
          </button>
          <button
            onClick={() => onResolve('replace')}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${alpha(C.b, 0.3)}`,
              background: alpha(C.b, 0.06),
              color: C.b,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Replace
          </button>
          <button
            onClick={() => onResolve('skip')}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${alpha(C.r, 0.2)}`,
              background: 'transparent',
              color: C.t3,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictResolver({ conflicts, onResolveAll }) {
  const [resolutions, setResolutions] = useState({});

  const handleResolve = useCallback((index, action) => {
    setResolutions((prev) => ({ ...prev, [index]: action }));
  }, []);

  const resolvedCount = Object.keys(resolutions).length;
  const allResolved = resolvedCount === (conflicts || []).length;

  const handleApply = useCallback(() => {
    if (onResolveAll) onResolveAll(resolutions);
  }, [resolutions, onResolveAll]);

  const handleBulkAction = useCallback(
    (action) => {
      const bulk = {};
      (conflicts || []).forEach((_, i) => {
        bulk[i] = action;
      });
      setResolutions(bulk);
    },
    [conflicts],
  );

  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--tf-font)', color: C.y }}>
            ⚠ {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Found
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
            {resolvedCount} of {conflicts.length} resolved
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleBulkAction('keep')}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${alpha(C.bd, 0.3)}`,
              background: 'transparent',
              color: C.t2,
              cursor: 'pointer',
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
            }}
          >
            Keep All
          </button>
          <button
            onClick={() => handleBulkAction('replace')}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${alpha(C.b, 0.2)}`,
              background: alpha(C.b, 0.06),
              color: C.b,
              cursor: 'pointer',
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
            }}
          >
            Replace All
          </button>
          <button
            onClick={() => handleBulkAction('skip')}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${alpha(C.r, 0.2)}`,
              background: 'transparent',
              color: C.t3,
              cursor: 'pointer',
              fontFamily: 'var(--tf-font)',
              fontWeight: 600,
            }}
          >
            Skip All
          </button>
        </div>
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 8, border: `1px solid ${alpha(C.bd, 0.3)}` }}>
        {conflicts.map((conflict, i) => (
          <ConflictRow
            key={i}
            existing={conflict.existing}
            incoming={conflict.incoming}
            onResolve={(action) => handleResolve(i, action)}
          />
        ))}
      </div>

      {allResolved && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={handleApply}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: C.b,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Apply Resolutions
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(ConflictResolver);
