// ═══════════════════════════════════════════════════════════════════
// charEdge v10.4 — Widget Grid System
// Sprint 8 C8.1: Drag-to-rearrange widget grid with persistence.
//
// Features:
//   - CSS Grid layout with configurable columns
//   - Drag-and-drop reordering (pointer events, works on touch too)
//   - Widget span control (1x1, 2x1, full-width)
//   - Layout saved to localStorage
//   - Smooth drag animations
//   - Drop zone highlighting
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { C } from '../../../constants.js';

const STORAGE_KEY = 'charEdge-dashboard-layout';

/**
 * @param {Array<{ id: string, span?: number, component: React.ReactNode }>} widgets
 * @param {number} cols - Grid columns (default 2)
 * @param {number} gap - Grid gap in px (default 16)
 * @param {boolean} editable - Enable drag-and-drop
 * @param {Function} onLayoutChange - Callback with new widget order
 */
function WidgetGrid({ widgets, cols = 2, gap = 16, editable = false, onLayoutChange }) {
  const [dragIdx, setDragIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);
  const [order, setOrder] = useState(() => widgets.map((_, i) => i));
  const gridRef = useRef(null);
  const _dragOffsetRef = useRef({ x: 0, y: 0 });

  // Sync order when widgets change
  useEffect(() => {
    setOrder((prev) => {
      // Keep existing order for known widgets, append new ones
      const existing = prev.filter((i) => i < widgets.length);
      const newOnes = widgets.map((_, i) => i).filter((i) => !existing.includes(i));
      return [...existing, ...newOnes];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets.length]);

  const orderedWidgets = order.map((i) => widgets[i]).filter(Boolean);

  // ─── Drag Handlers ────────────────────────────────────────
  const handleDragStart = useCallback(
    (e, idx) => {
      if (!editable) return;
      e.dataTransfer?.setData?.('text/plain', idx);
      setDragIdx(idx);
    },
    [editable],
  );

  const handleDragOver = useCallback(
    (e, idx) => {
      e.preventDefault();
      if (idx !== dragIdx) setOverIdx(idx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (e, dropIdx) => {
      e.preventDefault();
      if (dragIdx < 0 || dragIdx === dropIdx) {
        setDragIdx(-1);
        setOverIdx(-1);
        return;
      }

      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(dropIdx, 0, moved);
        return next;
      });

      setDragIdx(-1);
      setOverIdx(-1);
    },
    [dragIdx],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(-1);
    setOverIdx(-1);
  }, []);

  // Persist layout
  useEffect(() => {
    if (onLayoutChange) onLayoutChange(order);
    try {
      const ids = orderedWidgets.map((w) => w.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* storage may be blocked */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        width: '100%',
      }}
    >
      {orderedWidgets.map((widget, idx) => {
        const isDragging = idx === dragIdx;
        const isOver = idx === overIdx;
        const span = widget.span || 1;

        return (
          <div
            key={widget.id}
            draggable={editable}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            style={{
              gridColumn: span > 1 ? `span ${Math.min(span, cols)}` : undefined,
              opacity: isDragging ? 0.4 : 1,
              transform: isOver ? 'scale(1.01)' : 'scale(1)',
              transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
              outline: isOver ? `2px dashed ${C.b}` : 'none',
              outlineOffset: 2,
              borderRadius: 8,
              cursor: editable ? 'grab' : 'default',
              position: 'relative',
              minHeight: 0,
            }}
          >
            {/* Drag handle indicator (edit mode) */}
            {editable && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  display: 'flex',
                  gap: 2,
                  opacity: 0.4,
                }}
              >
                <div style={{ width: 4, height: 4, borderRadius: 2, background: C.t3 }} />
                <div style={{ width: 4, height: 4, borderRadius: 2, background: C.t3 }} />
                <div style={{ width: 4, height: 4, borderRadius: 2, background: C.t3 }} />
              </div>
            )}
            {widget.component}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Load saved layout order from localStorage.
 * @param {string[]} widgetIds - Available widget IDs
 * @returns {string[]} Ordered widget IDs
 */
export function loadLayout(widgetIds) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return widgetIds;
    // Reorder: saved first, then any new ones
    const ordered = saved.filter((id) => widgetIds.includes(id));
    const remaining = widgetIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...remaining];
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return widgetIds;
  }
}

/**
 * Save layout order.
 * @param {string[]} orderedIds
 */
export function saveLayout(orderedIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderedIds));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) { /* storage may be blocked */ }
}

export { WidgetGrid };

export default React.memo(WidgetGrid);
