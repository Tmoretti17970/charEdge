// ═══════════════════════════════════════════════════════════════════
// charEdge — SectionCustomizer
//
// Lightweight "Customize" dropdown for the Intel page header.
// Lets users drag-to-reorder sections and toggle visibility.
// Persists to localStorage under 'ce_intel_layout'.
// Uses native HTML5 drag-and-drop — no extra dependencies.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const STORAGE_KEY = 'ce_intel_layout';
const DEFAULT_ORDER = ['brief', 'pulse', 'signals', 'research', 'macro'];

const SECTION_LABELS = {
  brief: 'Brief',
  pulse: 'Pulse',
  signals: 'Signals',
  research: 'Research',
  macro: 'Macro',
};

/** Read saved layout from localStorage (or null). */
export function loadCustomLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.order) && Array.isArray(parsed.hidden)) return parsed;
  } catch {
    /* corrupted — ignore */
  }
  return null;
}

/** Persist layout to localStorage. */
function saveCustomLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota — ignore */
  }
}

/** Remove custom layout from localStorage. */
export function clearCustomLayout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ─── SectionCustomizer Component ─────────────────────────────────
function SectionCustomizer({ layout, onLayoutChange }) {
  const [open, setOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const order = layout ? layout.order : DEFAULT_ORDER;
  const hidden = useMemo(() => (layout ? layout.hidden : []), [layout]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const emit = useCallback(
    (nextOrder, nextHidden) => {
      const next = { order: nextOrder, hidden: nextHidden };
      saveCustomLayout(next);
      onLayoutChange(next);
    },
    [onLayoutChange],
  );

  // ─── Drag handlers ──────────────────────────────────────────
  const handleDragStart = useCallback((e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setData
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (e, dropIdx) => {
      e.preventDefault();
      if (dragIdx == null || dragIdx === dropIdx) {
        setDragIdx(null);
        setOverIdx(null);
        return;
      }
      const next = [...order];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      setDragIdx(null);
      setOverIdx(null);
      emit(next, hidden);
    },
    [dragIdx, order, hidden, emit],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // ─── Visibility toggle ─────────────────────────────────────
  const toggleVisibility = useCallback(
    (sectionId) => {
      const isHidden = hidden.includes(sectionId);
      const nextHidden = isHidden ? hidden.filter((h) => h !== sectionId) : [...hidden, sectionId];
      emit(order, nextHidden);
    },
    [hidden, order, emit],
  );

  // ─── Reset ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    clearCustomLayout();
    onLayoutChange(null);
    setOpen(false);
  }, [onLayoutChange]);

  const hasCustomLayout = layout != null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: `1px solid ${open ? alpha(C.b, 0.3) : C.bd}`,
          background: open ? alpha(C.b, 0.08) : 'transparent',
          color: open ? C.b : C.t3,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 11,
          fontFamily: F,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{'\u2699'}</span>
        Customize
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Customize section layout"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 240,
            zIndex: 1000,
            background: alpha(C.bg2 || C.sf, 0.95),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: `1px solid ${C.bd}`,
            boxShadow: `0 8px 32px ${alpha('#000', 0.25)}`,
            padding: '8px 0',
            fontFamily: F,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '6px 14px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: C.t2 || C.t1,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              borderBottom: `1px solid ${alpha(C.bd, 0.5)}`,
            }}
          >
            Section Order
          </div>

          {/* Section list */}
          <div style={{ padding: '6px 0' }}>
            {order.map((sectionId, idx) => {
              const isHidden = hidden.includes(sectionId);
              const isDragging = dragIdx === idx;
              const isOver = overIdx === idx && dragIdx != null && dragIdx !== idx;

              return (
                <div
                  key={sectionId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 14px',
                    cursor: isDragging ? 'grabbing' : 'default',
                    opacity: isHidden ? 0.5 : isDragging ? 0.6 : 1,
                    background: isOver ? alpha(C.b, 0.1) : isDragging ? alpha(C.b, 0.06) : 'transparent',
                    transition: 'background 0.15s ease, opacity 0.15s ease',
                    borderTop: isOver ? `2px solid ${alpha(C.b, 0.4)}` : '2px solid transparent',
                    userSelect: 'none',
                  }}
                >
                  {/* Drag handle */}
                  <span
                    style={{
                      color: C.t3,
                      cursor: 'grab',
                      fontSize: 14,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    title="Drag to reorder"
                  >
                    {'\u2261'}
                  </span>

                  {/* Section name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: isHidden ? C.t3 : C.t1,
                      fontFamily: F,
                    }}
                  >
                    {SECTION_LABELS[sectionId] || sectionId}
                  </span>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(sectionId);
                    }}
                    title={isHidden ? 'Show section' : 'Hide section'}
                    aria-label={isHidden ? `Show ${SECTION_LABELS[sectionId]}` : `Hide ${SECTION_LABELS[sectionId]}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      fontSize: 14,
                      lineHeight: 1,
                      color: isHidden ? C.t3 : C.t2 || C.t1,
                      opacity: isHidden ? 0.5 : 0.8,
                      transition: 'opacity 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {isHidden ? '\uD83D\uDEAB' : '\uD83D\uDC41'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Reset button */}
          {hasCustomLayout && (
            <div
              style={{
                padding: '6px 14px 4px',
                borderTop: `1px solid ${alpha(C.bd, 0.5)}`,
              }}
            >
              <button
                onClick={handleReset}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: alpha(C.t3, 0.08),
                  color: C.t3,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                  fontFamily: F,
                  transition: 'background 0.2s ease',
                }}
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(SectionCustomizer);
