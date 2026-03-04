// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Drawing Groups
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains drawing tool icons, tool groups, and dropdown selectors.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../../../constants.js';
import s from './ToolbarDrawingGroups.module.css';

// ─── SVG Drawing Tool Icons ───────────────────────────────────────
const S = 14; // icon size
const DrawIcon = ({ children }) => <svg width={S} height={S} viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>{children}</svg>;

const TOOL_ICONS = {
  trendline: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="2" cy="12" r="1.2" fill="currentColor" opacity="0.5"/><circle cx="12" cy="2" r="1.2" fill="currentColor" opacity="0.5"/></DrawIcon>,
  hline: <DrawIcon><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="3" y1="5" x2="3" y2="9" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/><line x1="11" y1="5" x2="11" y2="9" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/></DrawIcon>,
  vline: <DrawIcon><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></DrawIcon>,
  ray: <DrawIcon><line x1="2" y1="10" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><polygon points="12,4 9,3.5 9.5,6.5" fill="currentColor" opacity="0.7"/></DrawIcon>,
  arrow: <DrawIcon><line x1="2" y1="12" x2="11" y2="3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><polyline points="7,2.5 11,3 10.5,7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></DrawIcon>,
  fib: <DrawIcon><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.7"/><line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5"/><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5"/><line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.7"/></DrawIcon>,
  fibext: <DrawIcon><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.7"/><line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4"/><line x1="1" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4"/><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4"/><line x1="12" y1="2" x2="12" y2="11" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/></DrawIcon>,
  rect: <DrawIcon><rect x="2" y="3" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none"/></DrawIcon>,
  ellipse: <DrawIcon><ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none"/></DrawIcon>,
  triangle: <DrawIcon><polygon points="7,2 12,12 2,12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/></DrawIcon>,
  alertzone: <DrawIcon><rect x="2" y="4" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08"/><line x1="7" y1="6" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="9.5" r="0.5" fill="currentColor"/></DrawIcon>,
  text: <DrawIcon><text x="3" y="11" fontSize="11" fontWeight="700" fontFamily="serif" fill="currentColor">T</text></DrawIcon>,
  callout: <DrawIcon><rect x="1.5" y="2" width="11" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.1" fill="none"/><polygon points="4,9.5 6,12 8,9.5" fill="currentColor" opacity="0.6"/></DrawIcon>,
  measure: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6"/><line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></DrawIcon>,
};

export function TIcon({ id }) { return TOOL_ICONS[id] || <span style={{ fontSize: 13 }}>{id[0]?.toUpperCase()}</span>; }

// ─── ALL DRAWING TOOLS (flat for favorites) ───────────────────────
export const ALL_TOOLS = [
  { id: 'trendline', name: 'Trend Line' },
  { id: 'hline', name: 'Horizontal Line' },
  { id: 'vline', name: 'Vertical Line' },
  { id: 'ray', name: 'Ray' },
  { id: 'arrow', name: 'Arrow' },
  { id: 'fib', name: 'Fib Retracement' },
  { id: 'fibext', name: 'Fib Extension' },
  { id: 'rect', name: 'Rectangle' },
  { id: 'ellipse', name: 'Ellipse' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'alertzone', name: 'Alert Zone' },
  { id: 'text', name: 'Text' },
  { id: 'callout', name: 'Callout' },
  { id: 'measure', name: 'Measure' },
];

// ─── TOOL CATEGORIES ──────────────────────────────────────────────
export const DRAWING_GROUPS = [
  {
    id: 'lines',
    tools: [
      { id: 'trendline', name: 'Trend Line' },
      { id: 'hline', name: 'Horizontal Line' },
      { id: 'vline', name: 'Vertical Line' },
      { id: 'ray', name: 'Ray' },
      { id: 'arrow', name: 'Arrow' },
    ]
  },
  {
    id: 'fib',
    tools: [
      { id: 'fib', name: 'Fib Retracement' },
      { id: 'fibext', name: 'Fib Extension' },
    ]
  },
  {
    id: 'shapes',
    tools: [
      { id: 'rect', name: 'Rectangle' },
      { id: 'ellipse', name: 'Ellipse' },
      { id: 'triangle', name: 'Triangle' },
      { id: 'alertzone', name: 'Alert Zone' },
    ]
  },
  {
    id: 'text',
    tools: [
      { id: 'text', name: 'Text' },
      { id: 'callout', name: 'Callout' },
    ]
  },
  {
    id: 'measure',
    tools: [{ id: 'measure', name: 'Measure' }]
  }
];

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
