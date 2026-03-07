// ═══════════════════════════════════════════════════════════════════
// charEdge — Bento Grid Dashboard (4.9.2.1–5)
//
// CSS Grid + framer-motion bento-box dashboard with:
// - 1×1, 2×1, 2×2, 4×1 widget sizes
// - Snap-spring drag physics
// - Layout serialization to zustand
// - Quick-resize drag handles
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLUMN_COUNT = 4;
const ROW_HEIGHT = 180;
const GAP = 12;

const WIDGET_SIZES = {
  '1x1': { cols: 1, rows: 1 },
  '2x1': { cols: 2, rows: 1 },
  '2x2': { cols: 2, rows: 2 },
  '4x1': { cols: 4, rows: 1 },
};

const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

/**
 * BentoGrid — CSS Grid + framer-motion bento-box dashboard.
 *
 * @param {Object} props
 * @param {Array} props.widgets - Widget configuration array
 * @param {function} props.onLayoutChange - Callback when layout changes
 * @param {Object} props.savedLayout - Persisted layout positions
 * @param {function} props.renderWidget - Render function for widget content
 */
export default function BentoGrid({
  widgets = [],
  onLayoutChange,
  savedLayout = {},
  renderWidget,
}) {
  const [layout, setLayout] = useState(() => {
    // Merge saved layout with defaults
    return widgets.map((widget, i) => ({
      id: widget.id,
      size: widget.defaultSize || '1x1',
      col: savedLayout[widget.id]?.col ?? (i % COLUMN_COUNT),
      row: savedLayout[widget.id]?.row ?? Math.floor(i / COLUMN_COUNT),
      ...savedLayout[widget.id],
    }));
  });

  const [dragId, setDragId] = useState(null);
  const [resizeId, setResizeId] = useState(null);
  const gridRef = useRef(null);

  // Serialize layout on change
  useEffect(() => {
    if (onLayoutChange) {
      const serialized = {};
      layout.forEach((item) => {
        serialized[item.id] = { col: item.col, row: item.row, size: item.size };
      });
      onLayoutChange(serialized);
    }
  }, [layout, onLayoutChange]);

  // Compute grid position styles
  const getItemStyle = useCallback((item) => {
    const dims = WIDGET_SIZES[item.size] || WIDGET_SIZES['1x1'];
    return {
      gridColumn: `${item.col + 1} / span ${dims.cols}`,
      gridRow: `${item.row + 1} / span ${dims.rows}`,
    };
  }, []);

  // Handle drag end — snap to grid
  const handleDragEnd = useCallback((itemId, info) => {
    const grid = gridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const cellWidth = (rect.width - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
    const cellHeight = ROW_HEIGHT + GAP;

    const newCol = Math.max(0, Math.min(
      COLUMN_COUNT - 1,
      Math.round((info.point.x - rect.left) / (cellWidth + GAP))
    ));
    const newRow = Math.max(0, Math.round(
      (info.point.y - rect.top) / cellHeight
    ));

    setLayout((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, col: newCol, row: newRow } : item
      )
    );
    setDragId(null);
  }, []);

  // Handle resize — cycle through sizes
  const handleResize = useCallback((itemId) => {
    const sizeOrder = ['1x1', '2x1', '2x2', '4x1'];
    setLayout((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentIdx = sizeOrder.indexOf(item.size);
        const nextSize = sizeOrder[(currentIdx + 1) % sizeOrder.length];
        return { ...item, size: nextSize };
      })
    );
  }, []);

  const maxRow = useMemo(() => {
    return layout.reduce((max, item) => {
      const dims = WIDGET_SIZES[item.size] || WIDGET_SIZES['1x1'];
      return Math.max(max, item.row + dims.rows);
    }, 0);
  }, [layout]);

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMN_COUNT}, 1fr)`,
        gridTemplateRows: `repeat(${maxRow + 1}, ${ROW_HEIGHT}px)`,
        gap: GAP,
        padding: GAP,
        width: '100%',
        minHeight: '100%',
        position: 'relative',
      }}
    >
      <AnimatePresence>
        {layout.map((item) => {
          const widget = widgets.find((w) => w.id === item.id);
          if (!widget) return null;

          return (
            <motion.div
              key={item.id}
              layout
              layoutId={item.id}
              drag
              dragMomentum={false}
              dragElastic={0.1}
              onDragStart={() => setDragId(item.id)}
              onDragEnd={(_, info) => handleDragEnd(item.id, info)}
              transition={springTransition}
              style={{
                ...getItemStyle(item),
                cursor: dragId === item.id ? 'grabbing' : 'grab',
                zIndex: dragId === item.id ? 50 : 1,
              }}
              whileDrag={{ scale: 1.03, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
              className="tf-depth-raised"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div style={{
                height: '100%',
                borderRadius: 'var(--tf-radius-md)',
                border: 'var(--tf-glass-border)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Widget header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--tf-bd)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--tf-t2)',
                  fontFamily: 'var(--tf-font)',
                  userSelect: 'none',
                }}>
                  <span>{widget.title || widget.id}</span>
                  {/* Quick-resize handle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResize(item.id); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--tf-t3)',
                      cursor: 'nwse-resize',
                      fontSize: 10,
                      padding: '2px 4px',
                      borderRadius: 'var(--tf-radius-xs)',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--tf-sf2)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    title={`Current: ${item.size} — click to resize`}
                  >
                    ⊞ {item.size}
                  </button>
                </div>

                {/* Widget content */}
                <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                  {renderWidget ? renderWidget(widget, item.size) : (
                    <div style={{ color: 'var(--tf-t3)', fontSize: 12 }}>
                      {widget.title || widget.id}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
