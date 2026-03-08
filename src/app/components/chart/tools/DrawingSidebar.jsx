// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tools Sidebar (Sprint 12)
// Figma-style 44px left rail with categorized drawing tools.
// Slides in when draw mode is activated via toolbar toggle.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { C, GLASS, DEPTH } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';

// ─── Drawing Tool Data ───────────────────────────────────────────
const S = 16;
const DrawIcon = ({ children }) => (
  <svg width={S} height={S} viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
    {children}
  </svg>
);

const TOOL_ICONS = {
  trendline: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="2" cy="12" r="1.2" fill="currentColor" opacity="0.5" /><circle cx="12" cy="2" r="1.2" fill="currentColor" opacity="0.5" /></DrawIcon>,
  hline: <DrawIcon><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="3" y1="5" x2="3" y2="9" stroke="currentColor" strokeWidth="0.8" opacity="0.4" /><line x1="11" y1="5" x2="11" y2="9" stroke="currentColor" strokeWidth="0.8" opacity="0.4" /></DrawIcon>,
  vline: <DrawIcon><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></DrawIcon>,
  ray: <DrawIcon><line x1="2" y1="10" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><polygon points="12,4 9,3.5 9.5,6.5" fill="currentColor" opacity="0.7" /></DrawIcon>,
  arrow: <DrawIcon><line x1="2" y1="12" x2="11" y2="3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><polyline points="7,2.5 11,3 10.5,7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></DrawIcon>,
  fib: <DrawIcon><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.7" /><line x1="1" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5" /><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5" /><line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.7" /></DrawIcon>,
  fibext: <DrawIcon><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.7" /><line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4" /><line x1="1" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4" /><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.4" /><line x1="12" y1="2" x2="12" y2="11" stroke="currentColor" strokeWidth="0.6" opacity="0.3" /></DrawIcon>,
  rect: <DrawIcon><rect x="2" y="3" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" /></DrawIcon>,
  ellipse: <DrawIcon><ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none" /></DrawIcon>,
  triangle: <DrawIcon><polygon points="7,2 12,12 2,12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" /></DrawIcon>,
  alertzone: <DrawIcon><rect x="2" y="4" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08" /><line x1="7" y1="6" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="7" cy="9.5" r="0.5" fill="currentColor" /></DrawIcon>,
  text: <DrawIcon><text x="3" y="11" fontSize="11" fontWeight="700" fontFamily="serif" fill="currentColor">T</text></DrawIcon>,
  callout: <DrawIcon><rect x="1.5" y="2" width="11" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.1" fill="none" /><polygon points="4,9.5 6,12 8,9.5" fill="currentColor" opacity="0.6" /></DrawIcon>,
  measure: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6" /><line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></DrawIcon>,
  extendedline: <DrawIcon><line x1="1" y1="9" x2="13" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="4" cy="8" r="1" fill="currentColor" opacity="0.5" /><circle cx="10" cy="6" r="1" fill="currentColor" opacity="0.5" /></DrawIcon>,
  crossline: <DrawIcon><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6" /><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6" /></DrawIcon>,
  infoline: <DrawIcon><line x1="2" y1="10" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><text x="6" y="3" fontSize="6" fill="currentColor">i</text></DrawIcon>,
  fibtimezone: <DrawIcon><line x1="3" y1="1" x2="3" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.7" /><line x1="6" y1="1" x2="6" y2="13" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.4" /><line x1="10" y1="1" x2="10" y2="13" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.4" /></DrawIcon>,
  gannfan: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.7" /><line x1="2" y1="12" x2="12" y2="7" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="2" y1="12" x2="7" y2="2" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /></DrawIcon>,
  channel: <DrawIcon><line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.1" /><line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.1" /><line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.4" /></DrawIcon>,
  parallelchannel: <DrawIcon><line x1="1" y1="8" x2="13" y2="4" stroke="currentColor" strokeWidth="1.1" /><line x1="1" y1="12" x2="13" y2="8" stroke="currentColor" strokeWidth="1.1" /></DrawIcon>,
  pitchfork: <DrawIcon><line x1="2" y1="7" x2="12" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.5" /><line x1="2" y1="7" x2="12" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.5" /><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></DrawIcon>,
  polyline: <DrawIcon><polyline points="2,10 5,4 8,8 12,3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></DrawIcon>,
  longposition: <DrawIcon><rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4" /><line x1="2" y1="7" x2="12" y2="7" stroke="#089981" strokeWidth="1.2" /><text x="4" y="6" fontSize="5" fill="#089981">▲</text></DrawIcon>,
  shortposition: <DrawIcon><rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4" /><line x1="2" y1="7" x2="12" y2="7" stroke="#F23645" strokeWidth="1.2" /><text x="4" y="11" fontSize="5" fill="#F23645">▼</text></DrawIcon>,
  elliott: <DrawIcon><polyline points="2,10 4,4 6,8 8,2 10,12 12,6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></DrawIcon>,
  pricerange: <DrawIcon><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.6" /><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.6" /><line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.4" /></DrawIcon>,
  daterange: <DrawIcon><line x1="3" y1="1" x2="3" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.6" /><line x1="11" y1="1" x2="11" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.6" /><line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.4" /></DrawIcon>,
  note: <DrawIcon><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.06" /><line x1="4" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="4" y1="7.5" x2="9" y2="7.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /></DrawIcon>,
  signpost: <DrawIcon><line x1="7" y1="4" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><polygon points="3,2 11,2 12,4 3,4" fill="currentColor" opacity="0.6" /></DrawIcon>,
  gannsquare: <DrawIcon><rect x="2" y="2" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none" /><line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.3" /><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="0.6" opacity="0.3" /></DrawIcon>,
  xabcd: <DrawIcon><polyline points="2,10 4,4 6.5,8 9,3 12,9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /><text x="2" y="13" fontSize="4" fill="currentColor">X</text><text x="11" y="12" fontSize="4" fill="currentColor">D</text></DrawIcon>,
  headshoulders: <DrawIcon><polyline points="1,10 3,6 5,9 7,3 9,9 11,6 13,10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /><line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.4" /></DrawIcon>,
  emoji: <DrawIcon><text x="3" y="11" fontSize="12">📌</text></DrawIcon>,
  flattop: <DrawIcon><line x1="2" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><rect x="2" y="2" width="10" height="3" fill="currentColor" fillOpacity="0.08" /><line x1="2" y1="3" x2="2" y2="7" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /></DrawIcon>,
  flatbottom: <DrawIcon><line x1="2" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><rect x="2" y="9" width="10" height="3" fill="currentColor" fillOpacity="0.08" /><line x1="2" y1="7" x2="2" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="12" y1="7" x2="12" y2="11" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /></DrawIcon>,
};

const GROUPS = [
  {
    id: 'lines', label: 'Lines',
    tools: [
      { id: 'trendline', name: 'Trend Line', shortcut: 'T' },
      { id: 'hline', name: 'Horizontal Line', shortcut: 'H' },
      { id: 'vline', name: 'Vertical Line', shortcut: 'V' },
      { id: 'ray', name: 'Ray' },
      { id: 'extendedline', name: 'Extended Line' },
      { id: 'infoline', name: 'Info Line' },
      { id: 'arrow', name: 'Arrow' },
      { id: 'crossline', name: 'Cross Line' },
      { id: 'polyline', name: 'Polyline' },
    ],
  },
  {
    id: 'fib', label: 'Fibonacci',
    tools: [
      { id: 'fib', name: 'Fib Retracement', shortcut: 'F' },
      { id: 'fibext', name: 'Fib Extension' },
      { id: 'fibtimezone', name: 'Fib Time Zones' },
    ],
  },
  {
    id: 'channels', label: 'Channels',
    tools: [
      { id: 'channel', name: 'Parallel Channel' },
      { id: 'parallelchannel', name: 'Regression Channel' },
      { id: 'pitchfork', name: 'Pitchfork' },
    ],
  },
  {
    id: 'shapes', label: 'Shapes',
    tools: [
      { id: 'rect', name: 'Rectangle', shortcut: 'R' },
      { id: 'ellipse', name: 'Ellipse' },
      { id: 'triangle', name: 'Triangle' },
      { id: 'alertzone', name: 'Alert Zone' },
      { id: 'flattop', name: 'Flat Top (Resistance)' },
      { id: 'flatbottom', name: 'Flat Bottom (Support)' },
    ],
  },
  {
    id: 'patterns', label: 'Patterns',
    tools: [
      { id: 'gannfan', name: 'Gann Fan' },
      { id: 'gannsquare', name: 'Gann Square' },
      { id: 'elliott', name: 'Elliott Wave' },
      { id: 'xabcd', name: 'XABCD Pattern' },
      { id: 'headshoulders', name: 'Head & Shoulders' },
    ],
  },
  {
    id: 'text', label: 'Annotations',
    tools: [
      { id: 'text', name: 'Text' },
      { id: 'callout', name: 'Callout' },
      { id: 'note', name: 'Note' },
      { id: 'signpost', name: 'Signpost' },
      { id: 'emoji', name: 'Emoji Sticker' },
    ],
  },
  {
    id: 'measure', label: 'Measure',
    tools: [
      { id: 'measure', name: 'Measure', shortcut: 'M' },
      { id: 'pricerange', name: 'Price Range' },
      { id: 'daterange', name: 'Date Range' },
      { id: 'longposition', name: 'Long Position' },
      { id: 'shortposition', name: 'Short Position' },
    ],
  },
];

// ─── Group Icons (collapsed state) ───────────────────────────────
const GROUP_ICONS = {
  lines: <DrawIcon><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></DrawIcon>,
  fib: <DrawIcon><line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" strokeWidth="1" opacity="0.7" /><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5" /><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.7" /></DrawIcon>,
  channels: <DrawIcon><line x1="1" y1="8" x2="13" y2="4" stroke="currentColor" strokeWidth="1.2" /><line x1="1" y1="12" x2="13" y2="8" stroke="currentColor" strokeWidth="1.2" /></DrawIcon>,
  shapes: <DrawIcon><rect x="2" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" /></DrawIcon>,
  patterns: <DrawIcon><polyline points="2,10 5,4 8,8 12,3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></DrawIcon>,
  text: <DrawIcon><text x="3" y="11" fontSize="11" fontWeight="700" fontFamily="serif" fill="currentColor">T</text></DrawIcon>,
  measure: <DrawIcon><line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5" /></DrawIcon>,
};

// ─── Tooltip ─────────────────────────────────────────────────────
function ToolTip({ text, shortcut, pos }) {
  if (!pos) return null;
  return (
    <div
      className="tf-draw-sidebar-tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left + 8,
        transform: 'translateY(-50%)',
      }}
    >
      {text}
      {shortcut && <span className="tf-draw-sidebar-tooltip-key">{shortcut}</span>}
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────
export default function DrawingSidebar({ isOpen, onClose }) {
  const activeTool = useChartStore((s) => s.activeTool);
  const setActiveTool = useChartStore((s) => s.setActiveTool);
  const magnetMode = useChartStore((s) => s.magnetMode);
  const toggleMagnetMode = useChartStore((s) => s.toggleMagnetMode);
  const undoDrawing = useChartStore((s) => s.undoDrawing);
  const redoDrawing = useChartStore((s) => s.redoDrawing);
  const hasUndo = useChartStore((s) => s.drawingHistory.length > 0);
  const hasRedo = useChartStore((s) => s.drawingFuture.length > 0);
  const drawings = useChartStore((s) => s.drawings);

  const [expandedGroup, setExpandedGroup] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const sidebarRef = useRef(null);

  // ─── Drag state ──────────────────────────────────────────────
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('charEdge-draw-pos');
      return saved ? JSON.parse(saved) : { x: 8, y: 48 };
    } catch { return { x: 8, y: 48 }; }
  });
  const dragRef = useRef(null);

  const onDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev) => {
      const nx = Math.max(0, ev.clientX - startX);
      const ny = Math.max(0, ev.clientY - startY);
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Persist position
      setPos((p) => {
        try { localStorage.setItem('charEdge-draw-pos', JSON.stringify(p)); } catch { }
        return p;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Recents: persist 3 most-recently-used tool IDs
  const [recents, setRecents] = useState(() => {
    try {
      const saved = localStorage.getItem('charEdge-draw-recents');
      return saved ? JSON.parse(saved) : ['trendline', 'fib', 'rect'];
    } catch { return ['trendline', 'fib', 'rect']; }
  });

  // Find which group the active tool belongs to and auto-expand it
  useEffect(() => {
    if (activeTool) {
      for (const g of GROUPS) {
        if (g.tools.some((t) => t.id === activeTool)) {
          setExpandedGroup(g.id);
          return;
        }
      }
    }
  }, [activeTool]);

  const handleToolClick = (toolId) => {
    setActiveTool(activeTool === toolId ? null : toolId);
    // Update recents
    if (toolId && activeTool !== toolId) {
      const next = [toolId, ...recents.filter((r) => r !== toolId)].slice(0, 3);
      setRecents(next);
      try { localStorage.setItem('charEdge-draw-recents', JSON.stringify(next)); } catch { }
    }
  };

  const handleGroupClick = (groupId) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const handleClearAll = () => {
    const s = useChartStore.getState();
    if (s.drawings.length > 0) {
      useChartStore.setState({
        drawingHistory: [...s.drawingHistory.slice(-49), s.drawings],
        drawingFuture: [],
      });
      s.setDrawings([]);
    }
  };

  const showTooltip = (e, text, shortcut) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, shortcut, pos: { top: rect.top + rect.height / 2, left: rect.right } });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <>
      <div
        ref={sidebarRef}
        className="tf-drawing-sidebar"
        data-open={isOpen || undefined}
        style={{ left: pos.x, top: pos.y }}
      >
        {/* ─── Drag handle + close ─── */}
        <div
          ref={dragRef}
          onMouseDown={onDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'grab', padding: '0 2px 3px', borderBottom: '1px solid var(--tf-bd)',
            marginBottom: 3, userSelect: 'none',
          }}
        >
          {/* Grip dots */}
          <span style={{ fontSize: 8, color: 'var(--tf-t3)', letterSpacing: 2 }}>⠿</span>
          <span style={{ fontSize: 8, color: 'var(--tf-t3)', fontWeight: 600 }}>Draw</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--tf-t3)', cursor: 'pointer',
              fontSize: 12, padding: 0, lineHeight: 1,
            }}
            title="Hide palette"
          >✕</button>
        </div>

        {/* ─── Recents Row ─── */}
        {recents.length > 0 && (
          <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
            {recents.map((toolId) => (
              <button
                key={toolId}
                className="tf-drawing-sidebar-btn"
                data-active={activeTool === toolId || undefined}
                onClick={() => handleToolClick(toolId)}
                onMouseEnter={(e) => showTooltip(e, toolId)}
                onMouseLeave={hideTooltip}
              >
                {TOOL_ICONS[toolId] || <span style={{ fontSize: 10 }}>{toolId[0]?.toUpperCase()}</span>}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {/* Inline actions */}
            <button className="tf-drawing-sidebar-btn" data-active={magnetMode || undefined}
              onClick={toggleMagnetMode} title="Magnet">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 2v4a4 4 0 0 0 8 0V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            <button className="tf-drawing-sidebar-btn" onClick={undoDrawing} disabled={!hasUndo} title="Undo">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M4 5l-3 2.5L4 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M1 7.5h8a4 4 0 0 1 0 8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" />
              </svg>
            </button>
            <button className="tf-drawing-sidebar-btn" onClick={redoDrawing} disabled={!hasRedo} title="Redo">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M10 5l3 2.5L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M13 7.5H5a4 4 0 0 0 0 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6" />
              </svg>
            </button>
            <button className="tf-drawing-sidebar-btn" onClick={handleClearAll} disabled={drawings.length === 0} title="Clear">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 4h8l-.75 8.25a1 1 0 0 1-1 .75H4.75a1 1 0 0 1-1-.75L3 4z" stroke="currentColor" strokeWidth="1.1" fill="none" />
                <line x1="2" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* ─── Category icons (compact row) ─── */}
        <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {GROUPS.map((group) => {
            const isExpanded = expandedGroup === group.id;
            const hasActiveTool = group.tools.some((t) => t.id === activeTool);
            return (
              <button
                key={group.id}
                className="tf-drawing-sidebar-btn"
                data-active={hasActiveTool || undefined}
                data-expanded={isExpanded || undefined}
                onClick={() => handleGroupClick(group.id)}
                onMouseEnter={(e) => showTooltip(e, group.label)}
                onMouseLeave={hideTooltip}
              >
                {GROUP_ICONS[group.id]}
              </button>
            );
          })}
        </div>

        {/* ─── Expanded group tools (4-col grid) ─── */}
        {expandedGroup && (() => {
          const group = GROUPS.find((g) => g.id === expandedGroup);
          if (!group) return null;
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
              marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--tf-bd)',
            }}>
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  className="tf-drawing-sidebar-btn tf-drawing-sidebar-tool"
                  data-active={activeTool === tool.id || undefined}
                  onClick={() => handleToolClick(tool.id)}
                  onMouseEnter={(e) => showTooltip(e, tool.name, tool.shortcut)}
                  onMouseLeave={hideTooltip}
                >
                  {TOOL_ICONS[tool.id] || <span style={{ fontSize: 10 }}>{tool.id[0]?.toUpperCase()}</span>}
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Floating tooltip */}
      <ToolTip {...(tooltip || {})} />
    </>
  );
}

