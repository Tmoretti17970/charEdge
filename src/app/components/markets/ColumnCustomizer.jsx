// ═══════════════════════════════════════════════════════════════════
// charEdge — Column Customizer (Sprint 6)
//
// Dropdown panel for toggling column visibility in the Markets grid.
// Triggered by a gear icon in the grid header.
//
// Features:
//   - Toggle columns on/off with checkboxes
//   - "Reset to defaults" button
//   - Fixed columns (Asset) shown but disabled
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, memo } from 'react';
import { C } from '../../../constants.js';
import { useMarketsPrefsStore, ALL_COLUMNS, DEFAULT_COLUMNS } from '../../../state/useMarketsPrefsStore';
import { radii, transition, zIndex } from '../../../theme/tokens.js';

function ColumnCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const visibleColumns = useMarketsPrefsStore((s) => s.visibleColumns);
  const toggleColumn = useMarketsPrefsStore((s) => s.toggleColumn);
  const resetColumns = useMarketsPrefsStore((s) => s.resetColumns);

  const isDefault = JSON.stringify(visibleColumns) === JSON.stringify(DEFAULT_COLUMNS);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Gear trigger */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        title="Customize columns"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: radii.sm,
          border: `1px solid ${isOpen ? C.b : C.bd}40`,
          background: isOpen ? `${C.b}10` : 'transparent',
          cursor: 'pointer',
          transition: `all ${transition.base}`,
          color: isOpen ? C.b : C.t3,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            width: 220,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: radii.md,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: zIndex.dropdown,
            padding: '8px 0',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '6px 14px 8px',
              fontSize: 11,
              fontWeight: 700,
              color: C.t3,
              fontFamily: 'var(--tf-font)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: `1px solid ${C.bd}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Columns</span>
            {!isDefault && (
              <button
                onClick={resetColumns}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.b,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'var(--tf-mono)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Column toggles */}
          {ALL_COLUMNS.map((col) => {
            const isVisible = visibleColumns.includes(col.id);
            const isFixed = col.fixed;

            return (
              <div
                key={col.id}
                onClick={() => !isFixed && toggleColumn(col.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  cursor: isFixed ? 'default' : 'pointer',
                  opacity: isFixed ? 0.5 : 1,
                  transition: `background ${transition.fast}`,
                }}
                onMouseEnter={(e) => {
                  if (!isFixed) e.currentTarget.style.background = `${C.b}06`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${isVisible ? C.b : C.bd}`,
                    background: isVisible ? C.b : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `all ${transition.fast}`,
                    flexShrink: 0,
                  }}
                >
                  {isVisible && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="1.5 5 4 7.5 8.5 2.5" />
                    </svg>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.t1,
                    fontFamily: 'var(--tf-font)',
                  }}
                >
                  {col.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ColumnCustomizer);
