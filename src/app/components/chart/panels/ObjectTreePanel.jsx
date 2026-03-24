// ═══════════════════════════════════════════════════════════════════
// charEdge — Object Tree Panel (Sprint 18)
// Collapsible sidebar listing all drawings on chart.
// Each row: type icon, name/label, visibility 👁 toggle, lock 🔒.
// Click to select/scroll to drawing. Right-click context menu.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TOOL_LABELS } from '../../../../shared/drawingToolRegistry';
import s from './ObjectTreePanel.module.css';

// ─── Tool Icons ──────────────────────────────────────────────────

const TOOL_ICONS = {
  hline: '─',
  trendline: '╲',
  ray: '→',
  extendedline: '↔',
  hray: '⇥',
  vline: '│',
  rect: '▭',
  triangle: '△',
  ellipse: '◯',
  channel: '═',
  parallelchannel: '⫼',
  pitchfork: '⑂',
  fib: 'ⅎ',
  fibext: 'ⅎ+',
  text: 'T',
  callout: '💬',
  note: '📝',
  measure: '📏',
  pricerange: '$↕',
  daterange: '📅',
  elliott: '〰',
};

export default function ObjectTreePanel({ engine, visible, onClose }) {
  const [drawings, setDrawings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const panelRef = useRef(null);

  // Sync drawings from engine
  useEffect(() => {
    if (!engine) return;
    const sync = () => setDrawings([...(engine.drawings || [])]);
    sync();

    const handler = () => sync();
    window.addEventListener('charEdge:update-drawing-style', handler);
    window.addEventListener('charEdge:drawings-changed', handler);
    const interval = setInterval(sync, 500); // Fallback poll
    return () => {
      window.removeEventListener('charEdge:update-drawing-style', handler);
      window.removeEventListener('charEdge:drawings-changed', handler);
      clearInterval(interval);
    };
  }, [engine]);

  const handleSelect = useCallback((d) => {
    setSelectedId(d.id);
    if (engine) {
      engine.drawings?.forEach(dr => { dr.state = dr.id === d.id ? 'selected' : 'idle'; });
      engine._selectedDrawingId = d.id;
      engine._state = 'SELECTED';
      engine._notify?.();
    }
  }, [engine]);

  const handleToggleVisibility = useCallback((d) => {
    window.dispatchEvent(new CustomEvent('charEdge:toggle-visibility', { detail: d.id }));
  }, []);

  const handleToggleLock = useCallback((d) => {
    engine?.toggleLock(d.id);
  }, [engine]);

  const handleDelete = useCallback((d) => {
    engine?.removeDrawing(d.id);
    setCtxMenu(null);
  }, [engine]);

  const handleDuplicate = useCallback((d) => {
    engine?.duplicateDrawing(d.id);
    setCtxMenu(null);
  }, [engine]);

  const handleContextMenu = useCallback((e, d) => {
    e.preventDefault();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      drawing: d,
    });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [ctxMenu]);

  const sortedDrawings = useMemo(() => {
    return [...drawings].reverse(); // Newest on top
  }, [drawings]);

  if (!visible) return null;

  return (
    <div ref={panelRef} className={s.panel}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.headerTitle}>
          Objects ({drawings.length})
        </span>
        <button onClick={onClose} className={s.closeBtn}>
          ✕
        </button>
      </div>

      {/* Drawing list */}
      <div className={s.list}>
        {sortedDrawings.length === 0 && (
          <div className={s.emptyState}>
            No drawings on chart
          </div>
        )}

        {sortedDrawings.map(d => {
          const isSelected = d.id === selectedId || d.state === 'selected';
          const isLocked = d.locked;
          const isHidden = d.visible === false;
          const toolName = TOOL_LABELS[d.type] || d.type;
          const icon = TOOL_ICONS[d.type] || '✎';

          return (
            <div
              key={d.id}
              onClick={() => handleSelect(d)}
              onContextMenu={(e) => handleContextMenu(e, d)}
              className={s.drawingRow}
              data-selected={isSelected || undefined}
              data-hidden={isHidden || undefined}
            >
              {/* Type icon */}
              <span className={s.drawingIcon} style={{ color: d.style?.color || undefined }}>
                {icon}
              </span>

              {/* Name */}
              <span className={s.drawingName}>
                {d.label || toolName}
              </span>

              {/* Group badge */}
              {d._groupId && (
                <span className={s.groupBadge}>grp</span>
              )}

              {/* Visibility */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleVisibility(d); }}
                className={s.rowActionBtn}
                data-state={isHidden ? 'inactive' : 'active'}
                title={isHidden ? 'Show' : 'Hide'}
              >
                {isHidden ? '◻' : '👁'}
              </button>

              {/* Lock */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleLock(d); }}
                className={s.rowActionBtn}
                data-state={isLocked ? 'locked' : 'inactive'}
                title={isLocked ? 'Unlock' : 'Lock'}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom toolbar */}
      <div className={s.toolbar}>
        <button
          onClick={() => engine?.drawings?.forEach(d => { d.visible = true; })}
          className={s.toolbarBtn}
        >
          Show All
        </button>
        <button
          onClick={() => { if (confirm('Delete all drawings?')) { engine?.drawings?.splice(0); engine?._notify?.(); } }}
          className={`${s.toolbarBtn} ${s['toolbarBtn--danger']}`}
        >
          Clear All
        </button>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div className={s.ctxMenu} style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          {[
            { label: 'Edit', action: () => { handleSelect(ctxMenu.drawing); setCtxMenu(null); } },
            { label: 'Duplicate', action: () => handleDuplicate(ctxMenu.drawing) },
            { label: 'Delete', action: () => handleDelete(ctxMenu.drawing), danger: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={s.ctxMenuItem}
              data-danger={item.danger || undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
