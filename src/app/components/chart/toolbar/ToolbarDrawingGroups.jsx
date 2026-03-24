// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Drawing Groups
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains drawing tool dropdown selectors and magnet snap toggle.
// Icons, tool lists, and groups imported from central registry.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { C } from '@/constants.js';
import s from './ToolbarDrawingGroups.module.css';
import { TOOL_ICONS, TIcon, ALL_TOOLS, DRAWING_GROUPS } from '../../../../shared/drawingToolRegistry';

export { TIcon, ALL_TOOLS, DRAWING_GROUPS };

// ─── Toolbar Button Helper ────────────────────────────────────────
function ToolbarBtn({ children, active, onClick, disabled, title, style }) {
  return (
    <button
      className="tf-chart-toolbar-btn"
      data-active={active || undefined}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Drawing Group Component ──────────────────────────────────────
export default function DrawingGroup({ group, activeTool, setActiveTool }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const isActive = group.tools.some(t => t.id === activeTool);
  const currentToolId = group.tools.find(t => t.id === activeTool)?.id || group.tools[0].id;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = () => {
    if (isActive) setActiveTool(null);
    else setActiveTool(group.tools[0].id);
  };

  return (
    <div ref={containerRef} className={s.groupWrapper}>
      <ToolbarBtn
        active={isActive}
        onClick={handleClick}
        title={group.tools[0].name}
        style={{ padding: '4px 6px' }}
      >
        <TIcon id={currentToolId} />
      </ToolbarBtn>
      {group.tools.length > 1 && (
        <button
          onClick={() => setOpen(!open)}
          className={s.expandBtn}
        >
          ▼
        </button>
      )}

      {open && group.tools.length > 1 && (
        <div
          className={`tf-chart-dropdown ${s.dropdown}`}
        >
          {group.tools.map(tool => (
            <button
              key={tool.id}
              className="tf-chart-dropdown-item"
              data-active={activeTool === tool.id || undefined}
              onClick={() => { setActiveTool(tool.id); setOpen(false); }}
            >
              <span className={s.toolIconWrap}><TIcon id={tool.id} /></span>
              <span>{tool.name}</span>
              {activeTool === tool.id && <span className={s.checkMark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Magnet Snap Toggle ───────────────────────────────────────────
export function MagnetSnapToggle({ enabled, strength, onToggle, onStrengthChange }) {
  const [showPopover, setShowPopover] = useState(false);
  const timerRef = useRef(null);
  const btnRef = useRef(null);

  const handleMouseDown = () => {
    timerRef.current = setTimeout(() => setShowPopover(true), 500);
  };
  const handleMouseUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (!showPopover) return;
    const close = (e) => { if (btnRef.current && !btnRef.current.contains(e.target)) setShowPopover(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showPopover]);

  return (
    <div ref={btnRef} className={s.magnetWrap}>
      <ToolbarBtn
        active={enabled}
        onClick={onToggle}
        title={enabled ? 'Magnet Snap: ON' : 'Magnet Snap: OFF'}
        style={{ padding: '4px 6px' }}
      >
        <span
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={s.magnetIcon}
          data-active={enabled ? 'true' : undefined}
        >
          🧲
        </span>
      </ToolbarBtn>

      {showPopover && (
        <div className={s.magnetPopover}>
          {['weak', 'strong'].map(level => (
            <button
              key={level}
              onClick={() => { onStrengthChange(level); setShowPopover(false); }}
              className={s.popoverItem}
              data-active={strength === level ? 'true' : undefined}
            >
              <span className={s.popoverCheck}>{strength === level ? '✓' : ' '}</span>
              {level === 'weak' ? 'Weak (10px)' : 'Strong (25px)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
