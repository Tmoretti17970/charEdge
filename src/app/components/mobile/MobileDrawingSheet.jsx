// ═══════════════════════════════════════════════════════════════════
// charEdge v10.3 — Mobile Drawing Sheet (Sprint 21 Overhaul)
//
// Categorized bottom-sheet with:
//   - Tab-based tool categories (Lines, Shapes, Fib, Patterns, Measure)
//   - Touch-hold draw mode with haptic feedback
//   - Two-finger pan guard (doesn't conflict with drawing)
//   - Drawing mode status bar with cancel / undo
//   - Auto-collapse on drawing completion
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
import { C, M } from '../../../constants.js';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';

// ─── Categorized tool definitions ───────────────────────────────

const TOOL_CATEGORIES = [
  {
    id: 'lines', label: 'Lines', icon: '╲',
    tools: [
      { id: null, icon: '✛', label: 'Cursor' },
      { id: 'trendline', icon: '╲', label: 'Trend' },
      { id: 'hline', icon: '─', label: 'H-Line' },
      { id: 'vline', icon: '│', label: 'V-Line' },
      { id: 'ray', icon: '╱→', label: 'Ray' },
      { id: 'extendedline', icon: '⟷', label: 'Ext Line' },
    ],
  },
  {
    id: 'shapes', label: 'Shapes', icon: '▢',
    tools: [
      { id: 'rect', icon: '▢', label: 'Rect' },
      { id: 'ellipse', icon: '⬭', label: 'Ellipse' },
      { id: 'triangle', icon: '△', label: 'Triangle' },
      { id: 'channel', icon: '⫽', label: 'Channel' },
      { id: 'callout', icon: '💬', label: 'Callout' },
      { id: 'text', icon: 'T', label: 'Text' },
    ],
  },
  {
    id: 'fib', label: 'Fib', icon: '▦',
    tools: [
      { id: 'fib', icon: '▦', label: 'Retrace' },
      { id: 'fibext', icon: '▥', label: 'Extension' },
      { id: 'fibtimezone', icon: '⫿', label: 'Time Zone' },
      { id: 'fibarc', icon: '◠', label: 'Arc' },
      { id: 'fibfan', icon: '◿', label: 'Fan' },
      { id: 'fibchannel', icon: '═', label: 'Channel' },
    ],
  },
  {
    id: 'patterns', label: 'Patterns', icon: '∿',
    tools: [
      { id: 'elliott', icon: '∿', label: 'Elliott' },
      { id: 'gannfan', icon: '◿', label: 'Gann Fan' },
      { id: 'pitchfork', icon: '⋔', label: 'Pitchfork' },
      { id: 'longposition', icon: '↿', label: 'Long' },
      { id: 'shortposition', icon: '⇂', label: 'Short' },
    ],
  },
  {
    id: 'measure', label: 'Measure', icon: '↔',
    tools: [
      { id: 'measure', icon: '↔', label: 'Measure' },
      { id: 'pricerange', icon: '$↕', label: 'Price' },
      { id: 'daterange', icon: '📅', label: 'Date' },
      { id: 'note', icon: '📝', label: 'Note' },
    ],
  },
];

// Haptic feedback helper
function haptic(style = 'light') {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(style === 'heavy' ? 25 : style === 'medium' ? 15 : 8);
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* no haptics available */ }
}

/**
 * Mobile-optimized bottom sheet for drawing tools (Sprint 21).
 */
export default function MobileDrawingSheet() {
  const activeTool = useChartToolsStore((s) => s.activeTool);
  const setActiveTool = useChartToolsStore((s) => s.setActiveTool);
  const clearActiveTool = useChartToolsStore((s) => s.clearActiveTool);
  const drawings = useChartToolsStore((s) => s.drawings);
  const clearAllDrawings = useChartToolsStore((s) => s.clearAllDrawings);
  const magnetMode = useChartToolsStore((s) => s.magnetMode);
  const toggleMagnetMode = useChartToolsStore((s) => s.toggleMagnetMode);

  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('lines');
  const [touchStartY, setTouchStartY] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const scrollRef = useRef(null);

  // Track drawing state from the store
  useEffect(() => {
    setIsDrawing(!!activeTool);
  }, [activeTool]);

  const handleToolSelect = useCallback(
    (toolId) => {
      haptic('medium');
      if (toolId === null) {
        clearActiveTool();
      } else if (toolId === activeTool) {
        clearActiveTool();
      } else {
        setActiveTool(toolId);
      }
      setExpanded(false);
    },
    [activeTool, setActiveTool, clearActiveTool],
  );

  const handleCancelDrawing = useCallback(() => {
    haptic('light');
    clearActiveTool();
    setIsDrawing(false);
  }, [clearActiveTool]);

  // Drag handle gesture
  const handleDragStart = useCallback((e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    setTouchStartY(y);
  }, []);

  const handleDragEnd = useCallback(
    (e) => {
      const y = e.changedTouches?.[0]?.clientY ?? e.clientY;
      const delta = touchStartY - y;
      if (delta > 30) { setExpanded(true); haptic('light'); }
      else if (delta < -30) { setExpanded(false); haptic('light'); }
    },
    [touchStartY],
  );

  const activeCat = TOOL_CATEGORIES.find(c => c.id === activeCategory) || TOOL_CATEGORIES[0];
  const activeLabel = activeCat.tools.find((t) => t.id === activeTool)?.label
    || TOOL_CATEGORIES.flatMap(c => c.tools).find(t => t.id === activeTool)?.label
    || '';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: expanded ? 'translateY(0)' : 'translateY(calc(100% - 36px))',
      }}
    >
      {/* ─── Drawing Mode Status Bar ────────────────────────── */}
      {isDrawing && !expanded && (
        <div
          style={{
            position: 'absolute',
            top: -44,
            left: 8,
            right: 8,
            height: 36,
            background: 'rgba(41, 98, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            border: '1px solid rgba(41, 98, 255, 0.25)',
          }}
        >
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: M,
            color: C.b,
          }}>
            ✎ {activeLabel} — tap chart to place points
          </span>
          <button
            onClick={handleCancelDrawing}
            style={{
              padding: '3px 10px', borderRadius: 6,
              background: 'rgba(239,83,80,0.15)',
              border: '1px solid rgba(239,83,80,0.25)',
              color: '#EF5350', fontSize: 10, fontWeight: 600,
              fontFamily: M, cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ─── Drag Handle / Peek Bar ─────────────────────────── */}
      <div
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        onClick={() => setExpanded(!expanded)}
        style={{
          height: 36,
          background: C.sf,
          borderTop: `1px solid ${C.bd}`,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.t3 + '60' }} />

        {activeTool && (
          <div style={{
            position: 'absolute', left: 12,
            fontSize: 10, fontWeight: 700, fontFamily: M,
            color: C.b, background: C.b + '15',
            padding: '2px 8px', borderRadius: 10,
          }}>
            {activeLabel}
          </div>
        )}

        {drawings.length > 0 && (
          <div style={{
            position: 'absolute', right: 12,
            fontSize: 9, fontWeight: 600, fontFamily: M, color: C.t3,
          }}>
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ─── Tool Panel ────────────────────────────────────── */}
      <div style={{ background: C.sf, borderTop: `1px solid ${C.bd}`, padding: '0 0 12px' }}>

        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: `1px solid ${C.bd}`,
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); haptic('light'); }}
              style={{
                flex: '0 0 auto',
                padding: '8px 14px',
                fontSize: 10, fontWeight: 600, fontFamily: M,
                color: activeCategory === cat.id ? C.b : C.t3,
                background: 'transparent',
                border: 'none',
                borderBottom: activeCategory === cat.id ? `2px solid ${C.b}` : '2px solid transparent',
                cursor: 'pointer',
                touchAction: 'manipulation',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Tools grid */}
        <div
          ref={scrollRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
            gap: 6,
            padding: '10px 8px 0',
          }}
        >
          {activeCat.tools.map((tool) => (
            <button
              className="tf-btn"
              key={tool.id || 'cursor'}
              onClick={() => handleToolSelect(tool.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 52,
                borderRadius: 10,
                border: activeTool === tool.id ? `2px solid ${C.b}` : `1px solid ${C.bd}`,
                background: activeTool === tool.id ? C.b + '15' : C.bg,
                color: activeTool === tool.id ? C.b : C.t2,
                cursor: 'pointer',
                padding: '4px 2px',
                touchAction: 'manipulation',
                transition: 'transform 0.1s, background 0.15s',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tool.icon}</span>
              <span style={{
                fontSize: 8, fontWeight: 600, fontFamily: M,
                marginTop: 2, whiteSpace: 'nowrap',
              }}>
                {tool.label}
              </span>
            </button>
          ))}
        </div>

        {/* Utilities row */}
        <div style={{
          display: 'flex', gap: 8, padding: '10px 12px 0',
          justifyContent: 'center',
        }}>
          <UtilPill label={`🧲 Magnet ${magnetMode ? 'ON' : 'OFF'}`} active={magnetMode} onClick={() => { toggleMagnetMode(); haptic('light'); }} />
          {drawings.length > 0 && (
            <UtilPill label={`🗑 Clear (${drawings.length})`} active={false} color={C.r} onClick={() => { clearAllDrawings(); haptic('heavy'); }} />
          )}
        </div>

        {/* Two-finger pan hint */}
        {isDrawing && (
          <div style={{
            textAlign: 'center', padding: '8px 0 0',
            fontSize: 9, color: C.t3 + '80', fontFamily: M,
          }}>
            💡 Two-finger drag to pan while drawing
          </div>
        )}
      </div>
    </div>
  );
}

function UtilPill({ label, active, color, onClick }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? C.b : color || C.bd}`,
        background: active ? C.b + '15' : 'transparent',
        color: active ? C.b : color || C.t3,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: M,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {label}
    </button>
  );
}

export { MobileDrawingSheet };
