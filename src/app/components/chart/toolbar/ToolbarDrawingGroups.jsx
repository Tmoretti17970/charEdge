// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Drawing Groups
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains drawing tool dropdown selectors and magnet snap toggle.
// Icons, tool lists, and groups imported from central registry.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { C } from '../../../../constants.js';
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
          style={{ color: C.t3 }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.t1}
          onMouseLeave={(e) => e.currentTarget.style.color = C.t3}
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
              {activeTool === tool.id && <span className={s.checkMark} style={{ color: C.b }}>✓</span>}
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
    <div ref={btnRef} style={{ position: 'relative' }}>
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
          style={{
            display: 'block', fontSize: 14,
            filter: enabled ? 'drop-shadow(0 0 4px rgba(41,98,255,0.5))' : 'none',
            transition: 'all 0.2s',
          }}
        >
          🧲
        </span>
      </ToolbarBtn>

      {showPopover && (
        <div style={{
          position: 'absolute', left: '100%', top: -4, marginLeft: 6,
          background: 'rgba(24,26,32,0.97)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
          padding: '6px 0', zIndex: 9999, minWidth: 140,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          animation: 'scaleInSm 0.12s ease-out',
        }}>
          {['weak', 'strong'].map(level => (
            <button
              key={level}
              onClick={() => { onStrengthChange(level); setShowPopover(false); }}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '7px 14px', background: 'transparent', border: 'none',
                color: strength === level ? '#2962FF' : '#D1D4DC',
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
                fontWeight: strength === level ? 600 : 400,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(41,98,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ marginRight: 8 }}>{strength === level ? '✓' : ' '}</span>
              {level === 'weak' ? 'Weak (10px)' : 'Strong (25px)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
