// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tools Sidebar (Sprint 12)
// Figma-style 44px left rail with categorized drawing tools.
// Slides in when draw mode is activated via toolbar toggle.
// Icons and groups imported from central registry.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { TOOL_ICONS, DRAWING_GROUPS, GROUP_ICONS } from '../../../../shared/drawingToolRegistry';
import s from './DrawingSidebar.module.css';

function ToolTip({ text, shortcut, pos }) {
  if (!pos) return null;
  return (
    <div className="tf-draw-sidebar-tooltip" style={{ position: 'fixed', top: pos.top, left: pos.left + 8, transform: 'translateY(-50%)' }}>
      {text}
      {shortcut && <span className="tf-draw-sidebar-tooltip-key">{shortcut}</span>}
    </div>
  );
}

export default function DrawingSidebar({ isOpen, onClose }) {
  const activeTool = useChartToolsStore((st) => st.activeTool);
  const setActiveTool = useChartToolsStore((st) => st.setActiveTool);
  const magnetMode = useChartToolsStore((st) => st.magnetMode);
  const toggleMagnetMode = useChartToolsStore((st) => st.toggleMagnetMode);
  const undoDrawing = useChartToolsStore((st) => st.undoDrawing);
  const redoDrawing = useChartToolsStore((st) => st.redoDrawing);
  const hasUndo = useChartToolsStore((st) => st.drawingHistory.length > 0);
  const hasRedo = useChartToolsStore((st) => st.drawingFuture.length > 0);
  const drawings = useChartToolsStore((st) => st.drawings);

  const [expandedGroup, setExpandedGroup] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const sidebarRef = useRef(null);

  const [pos, setPos] = useState(() => {
    try { const saved = localStorage.getItem('charEdge-draw-pos'); return saved ? JSON.parse(saved) : { x: 8, y: 48 }; } catch { return { x: 8, y: 48 }; }
  });

  const onDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev) => { setPos({ x: Math.max(0, ev.clientX - startX), y: Math.max(0, ev.clientY - startY) }); };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); setPos((p) => { try { localStorage.setItem('charEdge-draw-pos', JSON.stringify(p)); } catch { /* no-op */ } return p; }); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (activeTool) { for (const g of DRAWING_GROUPS) { if (g.tools.some((t) => t.id === activeTool)) { setExpandedGroup(g.id); return; } } }
  }, [activeTool]);

  const handleToolClick = (toolId) => setActiveTool(activeTool === toolId ? null : toolId);
  const handleGroupClick = (groupId) => setExpandedGroup(expandedGroup === groupId ? null : groupId);

  const handleClearAll = () => {
    const st = useChartToolsStore.getState();
    if (st.drawings.length > 0) { useChartToolsStore.setState({ drawingHistory: [...st.drawingHistory.slice(-49), st.drawings], drawingFuture: [] }); st.setDrawings([]); }
  };

  const showTooltip = (e, text, shortcut) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, shortcut, pos: { top: rect.top + rect.height / 2, left: rect.right } });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <>
      <div ref={sidebarRef} className="tf-drawing-sidebar" data-open={isOpen || undefined} style={{ left: pos.x, top: pos.y }}>
        <div className={s.dragHandle} onMouseDown={onDragStart}>
          <span className={s.gripDots}>⠿</span>
          <span className={s.gripLabel}>Draw</span>
          <button onClick={onClose} className={s.gripClose} title="Hide palette">✕</button>
        </div>

        <div className={s.utilRow}>
          <button className="tf-drawing-sidebar-btn" data-active={magnetMode || undefined} onClick={toggleMagnetMode} title="Magnet">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 2v4a4 4 0 0 0 8 0V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
          <button className="tf-drawing-sidebar-btn" onClick={undoDrawing} disabled={!hasUndo} title="Undo">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 5l-3 2.5L4 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M1 7.5h8a4 4 0 0 1 0 8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" /></svg>
          </button>
          <button className="tf-drawing-sidebar-btn" onClick={redoDrawing} disabled={!hasRedo} title="Redo">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M10 5l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M13 7.5H5a4 4 0 0 0 0 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" /></svg>
          </button>
          <button className="tf-drawing-sidebar-btn" onClick={handleClearAll} disabled={drawings.length === 0} title="Clear">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4h8l-.75 8.25a1 1 0 0 1-1 .75H4.75a1 1 0 0 1-1-.75L3 4z" stroke="currentColor" strokeWidth="1.1" fill="none" /><line x1="2" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className={s.catRow}>
          {DRAWING_GROUPS.map((group) => {
            const hasActiveTool = group.tools.some((t) => t.id === activeTool);
            return (
              <button key={group.id} className="tf-drawing-sidebar-btn" data-active={hasActiveTool || undefined} data-expanded={expandedGroup === group.id || undefined}
                onClick={() => handleGroupClick(group.id)} onMouseEnter={(e) => showTooltip(e, group.label)} onMouseLeave={hideTooltip}>
                {GROUP_ICONS[group.id]}
              </button>
            );
          })}
        </div>

        {expandedGroup && (() => {
          const group = DRAWING_GROUPS.find((g) => g.id === expandedGroup);
          if (!group) return null;
          return (
            <div className={s.toolGrid}>
              {group.tools.map((tool) => (
                <button key={tool.id} className="tf-drawing-sidebar-btn tf-drawing-sidebar-tool" data-active={activeTool === tool.id || undefined}
                  onClick={() => handleToolClick(tool.id)} onMouseEnter={(e) => showTooltip(e, tool.name, tool.shortcut)} onMouseLeave={hideTooltip}>
                  {TOOL_ICONS[tool.id] || <span className={s.fallbackIcon}>{tool.id[0]?.toUpperCase()}</span>}
                </button>
              ))}
            </div>
          );
        })()}
      </div>
      <ToolTip {...(tooltip || {})} />
    </>
  );
}
