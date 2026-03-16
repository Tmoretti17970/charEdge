// ═══════════════════════════════════════════════════════════════════
// charEdge — Object Tree Panel (Sprint 18)
// Collapsible sidebar listing all drawings on chart.
// Each row: type icon, name/label, visibility 👁 toggle, lock 🔒.
// Click to select/scroll to drawing. Right-click context menu.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TOOL_LABELS } from '../../../../shared/drawingToolRegistry';

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

// Frosted glass style
const PANEL_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 250,
  height: '100%',
  background: 'rgba(30, 33, 42, 0.92)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  zIndex: 100,
  overflow: 'hidden',
  transition: 'transform 0.2s ease, opacity 0.2s ease',
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
      // Select drawing in engine
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
    <div ref={panelRef} style={PANEL_STYLE}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#D1D4DC',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Objects ({drawings.length})
        </span>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            border: 'none', color: '#787B86',
            cursor: 'pointer', fontSize: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Drawing list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 0',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}>
        {sortedDrawings.length === 0 && (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            color: '#787B86', fontSize: '12px',
          }}>
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
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px',
                background: isSelected ? 'rgba(41, 98, 255, 0.12)' : 'transparent',
                cursor: 'pointer',
                opacity: isHidden ? 0.4 : 1,
                transition: 'background 0.12s ease',
                borderLeft: isSelected ? '2px solid #2962FF' : '2px solid transparent',
              }}
            >
              {/* Type icon */}
              <span style={{
                fontSize: '14px', width: 20, textAlign: 'center',
                color: d.style?.color || '#787B86',
              }}>
                {icon}
              </span>

              {/* Name */}
              <span style={{
                flex: 1, fontSize: '12px', color: '#D1D4DC',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {d.label || toolName}
              </span>

              {/* Group badge */}
              {d._groupId && (
                <span style={{
                  fontSize: '9px', padding: '1px 4px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '3px', color: '#787B86',
                }}>
                  grp
                </span>
              )}

              {/* Visibility */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleVisibility(d); }}
                style={{
                  width: 20, height: 20, borderRadius: '4px',
                  background: 'transparent', border: 'none',
                  color: isHidden ? '#787B86' : '#D1D4DC',
                  cursor: 'pointer', fontSize: '11px',
                }}
                title={isHidden ? 'Show' : 'Hide'}
              >
                {isHidden ? '◻' : '👁'}
              </button>

              {/* Lock */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleLock(d); }}
                style={{
                  width: 20, height: 20, borderRadius: '4px',
                  background: 'transparent', border: 'none',
                  color: isLocked ? '#EF5350' : '#787B86',
                  cursor: 'pointer', fontSize: '11px',
                }}
                title={isLocked ? 'Unlock' : 'Lock'}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => engine?.drawings?.forEach(d => { d.visible = true; })}
          style={{
            padding: '4px 8px', fontSize: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px', color: '#787B86',
            cursor: 'pointer',
          }}
        >
          Show All
        </button>
        <button
          onClick={() => { if (confirm('Delete all drawings?')) { engine?.drawings?.splice(0); engine?._notify?.(); } }}
          style={{
            padding: '4px 8px', fontSize: '10px',
            background: 'rgba(239,83,80,0.1)',
            border: '1px solid rgba(239,83,80,0.15)',
            borderRadius: '6px', color: '#EF5350',
            cursor: 'pointer',
          }}
        >
          Clear All
        </button>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: 'rgba(30, 33, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '4px 0',
            minWidth: 140,
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}
        >
          {[
            { label: 'Edit', action: () => { handleSelect(ctxMenu.drawing); setCtxMenu(null); } },
            { label: 'Duplicate', action: () => handleDuplicate(ctxMenu.drawing) },
            { label: 'Delete', action: () => handleDelete(ctxMenu.drawing), danger: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              style={{
                display: 'block', width: '100%',
                padding: '8px 14px', textAlign: 'left',
                background: 'transparent', border: 'none',
                color: item.danger ? '#EF5350' : '#D1D4DC',
                fontSize: '12px', cursor: 'pointer',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
