// ═══════════════════════════════════════════════════════════════════
// charEdge — Quick Style Palette (Sprint 1)
// Floating mini-palette that appears when a drawing tool is active.
// Shows 5 saved color/width combos for one-click style switching.
// Inspired by Procreate's recent colors palette.
// ═══════════════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import s from './QuickStylePalette.module.css';

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
      className={s.swatch}
      data-active={active || undefined}
      style={{ width: size, height: size, background: color }}
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
      className={s.widthDotBtn}
      data-active={active || undefined}
    >
      <span className={s.widthDotInner} style={{ width: dotSize, height: dotSize }} />
    </button>
  );
}

export default function QuickStylePalette() {
  const activeTool = useChartToolsStore((st) => st.activeTool);
  const quickStyles = useChartToolsStore((st) => st.quickStyles);
  const activeQuickStyleId = useChartToolsStore((st) => st.activeQuickStyleId);
  const setActiveQuickStyle = useChartToolsStore((st) => st.setActiveQuickStyle);
  const updateQuickStyle = useChartToolsStore((st) => st.updateQuickStyle);
  const setDrawingColor = useChartToolsStore((st) => st.setDrawingColor);
  const stickyMode = useChartToolsStore((st) => st.stickyMode);
  const toggleStickyMode = useChartToolsStore((st) => st.toggleStickyMode);

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
    <div className={s.palette}>
      {/* Sticky mode toggle */}
      <button
        onClick={toggleStickyMode}
        title={stickyMode ? 'Sticky mode ON — tool stays active after each drawing (Esc to exit)' : 'Enable sticky mode — keep tool active after each drawing'}
        className={s.stickyBtn}
        data-active={stickyMode || undefined}
      >
        {stickyMode ? '📌' : '📍'}
      </button>

      {/* Divider */}
      <div className={s.divider} />

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
        className={s.editBtn}
      >
        ✏️
      </button>

      {/* Mini Editor Popover */}
      {showEditor && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={s.editorPopover}
        >
          <div className={s.editorLabel}>EDIT QUICK STYLE</div>

          {/* Color grid */}
          <div className={s.colorGrid}>
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
          <div className={s.customColorRow}>
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className={s.customColorInput}
            />
            <span className={s.customColorLabel}>
              {editColor.toUpperCase()}
            </span>
          </div>

          {/* Line width selector */}
          <div className={s['editorLabel--width']}>LINE WIDTH</div>
          <div className={s.widthRow}>
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
          <div className={s.editorActions}>
            <button onClick={handleSaveEdit} className={s.saveBtn}>Save</button>
            <button onClick={() => { setShowEditor(false); setEditingId(null); }} className={s.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}
