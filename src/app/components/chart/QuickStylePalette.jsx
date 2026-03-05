// ═══════════════════════════════════════════════════════════════════
// charEdge — Quick Style Palette (Sprint 1)
// Floating mini-palette that appears when a drawing tool is active.
// Shows 5 saved color/width combos for one-click style switching.
// Inspired by Procreate's recent colors palette.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { useChartStore } from '../../../state/useChartStore.js';

const PALETTE_COLORS = [
  '#2962FF', '#EF5350', '#26A69A', '#FF9800', '#AB47BC',
  '#EC407A', '#42A5F5', '#66BB6A', '#FFA726', '#78909C',
  '#5C6BC0', '#26C6DA', '#D4E157', '#FF7043', '#8D6E63',
];

const LINE_WIDTHS = [1, 1.5, 2, 3, 4];

/** Tiny color swatch button */
function Swatch({ color, active, onClick, size = 22 }) {
  return (
    <button
      onClick={onClick}
      title={color}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: active ? '2px solid #fff' : '2px solid transparent',
        background: color,
        cursor: 'pointer',
        padding: 0,
        outline: active ? '1px solid rgba(41,98,255,0.6)' : 'none',
        boxShadow: active ? '0 0 6px rgba(41,98,255,0.4)' : 'none',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    />
  );
}

/** Width dot selector */
function WidthDot({ width, active, onClick }) {
  const dotSize = 4 + width * 3;
  return (
    <button
      onClick={onClick}
      title={`${width}px`}
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: '#fff',
        display: 'block',
      }} />
    </button>
  );
}

export default function QuickStylePalette() {
  const activeTool = useChartStore((s) => s.activeTool);
  const quickStyles = useChartStore((s) => s.quickStyles);
  const activeQuickStyleId = useChartStore((s) => s.activeQuickStyleId);
  const setActiveQuickStyle = useChartStore((s) => s.setActiveQuickStyle);
  const updateQuickStyle = useChartStore((s) => s.updateQuickStyle);
  const setDrawingColor = useChartStore((s) => s.setDrawingColor);
  const stickyMode = useChartStore((s) => s.stickyMode);
  const toggleStickyMode = useChartStore((s) => s.toggleStickyMode);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editColor, setEditColor] = useState('#2962FF');
  const [editWidth, setEditWidth] = useState(2);

  // Apply a quick-style — sets drawingColor in store, which ChartEngineWidget syncs to engine
  const handleSelectStyle = useCallback((qs) => {
    setActiveQuickStyle(qs.id);
    setDrawingColor(qs.color);
  }, [setActiveQuickStyle, setDrawingColor]);

  // Open the mini-editor for a specific quick style
  const handleEditStyle = useCallback((qs) => {
    setEditingId(qs.id);
    setEditColor(qs.color);
    setEditWidth(qs.lineWidth);
    setShowEditor(true);
  }, []);

  // Save edited quick style
  const handleSaveEdit = useCallback(() => {
    if (editingId) {
      updateQuickStyle(editingId, { color: editColor, lineWidth: editWidth });
    }
    setShowEditor(false);
    setEditingId(null);
  }, [editingId, editColor, editWidth, updateQuickStyle]);

  if (!activeTool) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(19, 23, 34, 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: '6px 10px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      zIndex: 1000,
      userSelect: 'none',
      animation: 'scaleInSm 0.2s ease-out',
    }}>
      {/* Sticky mode toggle */}
      <button
        onClick={toggleStickyMode}
        title={stickyMode ? 'Sticky mode ON — tool stays active after each drawing (Esc to exit)' : 'Enable sticky mode — keep tool active after each drawing'}
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          border: 'none',
          background: stickyMode ? 'rgba(41, 98, 255, 0.3)' : 'rgba(255,255,255,0.06)',
          color: stickyMode ? '#2962FF' : 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        {stickyMode ? '📌' : '📍'}
      </button>

      {/* Divider */}
      <div style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.1)',
        flexShrink: 0,
      }} />

      {/* Quick style swatches */}
      {quickStyles.slice(0, 8).map((qs) => (
        <Swatch
          key={qs.id}
          color={qs.color}
          active={activeQuickStyleId === qs.id}
          onClick={() => handleSelectStyle(qs)}
        />
      ))}

      {/* Edit button */}
      <button
        onClick={() => {
          const activeQs = quickStyles.find(qs => qs.id === activeQuickStyleId);
          if (activeQs) {
            handleEditStyle(activeQs);
          } else if (quickStyles.length > 0) {
            handleEditStyle(quickStyles[0]);
          }
        }}
        title="Edit styles"
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          border: '1px dashed rgba(255,255,255,0.2)',
          background: 'transparent',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        ✏️
      </button>

      {/* Mini Editor Popover */}
      {showEditor && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            background: 'rgba(19, 23, 34, 0.96)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 12,
            padding: 14,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            width: 200,
            zIndex: 1001,
          }}
        >
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600 }}>
            EDIT QUICK STYLE
          </div>

          {/* Color grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {PALETTE_COLORS.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={editColor === c}
                onClick={() => setEditColor(c)}
                size={20}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              style={{
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                padding: 0,
                background: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              {editColor.toUpperCase()}
            </span>
          </div>

          {/* Line width selector */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight: 600 }}>
            LINE WIDTH
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {LINE_WIDTHS.map((w) => (
              <WidthDot
                key={w}
                width={w}
                active={editWidth === w}
                onClick={() => setEditWidth(w)}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleSaveEdit}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: 6,
                border: 'none',
                background: '#2962FF',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => { setShowEditor(false); setEditingId(null); }}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
