// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Favorites Toolbar
// Compact pill bar for pinning frequently-used drawing tools.
// Persisted to localStorage. Rendered below the main toolbar.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';

const LS_KEY = 'charEdge:drawingFavorites';

// Tool definitions with icons and labels
const TOOL_CATALOG = {
  trendline:     { label: 'Trend Line',    icon: '📈' },
  hline:         { label: 'Horizontal Line', icon: '➖' },
  ray:           { label: 'Ray',           icon: '↗' },
  segment:       { label: 'Segment',       icon: '📏' },
  fib:           { label: 'Fib Retracement', icon: '🔶' },
  fibext:        { label: 'Fib Extension', icon: '🔷' },
  rectangle:     { label: 'Rectangle',    icon: '⬜' },
  ellipse:       { label: 'Ellipse',      icon: '⭕' },
  text:          { label: 'Text',         icon: 'T' },
  callout:       { label: 'Callout',      icon: '💬' },
  ruler:         { label: 'Ruler',        icon: '📐' },
  pricerange:    { label: 'Price Range',  icon: '↕' },
  pitchfork:     { label: 'Pitchfork',    icon: '🔱' },
  arrow_up:      { label: 'Arrow Up',     icon: '▲' },
  arrow_down:    { label: 'Arrow Down',   icon: '▼' },
  longposition:  { label: 'Long Position', icon: '🟢' },
  shortposition: { label: 'Short Position', icon: '🔴' },
};

const DEFAULT_FAVORITES = ['trendline', 'hline', 'fib', 'rectangle', 'text'];

function loadFavorites() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_FAVORITES;
}

function saveFavorites(favs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(favs));
  } catch {}
}

export default function DrawingFavorites({ activeTool, onSelectTool }) {
  const [favorites, setFavorites] = useState(loadFavorites);
  const [showEditor, setShowEditor] = useState(false);
  const [hovered, setHovered] = useState(null);

  // Persist
  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  const toggleFavorite = useCallback((toolId) => {
    setFavorites(prev => {
      if (prev.includes(toolId)) {
        return prev.filter(t => t !== toolId);
      }
      return [...prev, toolId];
    });
  }, []);

  const catalogEntries = useMemo(() =>
    Object.entries(TOOL_CATALOG).map(([id, meta]) => ({
      id, ...meta, isFav: favorites.includes(id),
    })),
    [favorites]
  );

  if (favorites.length === 0 && !showEditor) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '2px 4px',
      borderRadius: '8px',
      background: 'rgba(28, 30, 38, 0.6)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Favorite tool buttons */}
      {favorites.map(toolId => {
        const meta = TOOL_CATALOG[toolId];
        if (!meta) return null;
        const isActive = activeTool === toolId;
        const isHovered = hovered === toolId;
        return (
          <button
            key={toolId}
            onClick={() => onSelectTool(toolId)}
            onMouseEnter={() => setHovered(toolId)}
            onMouseLeave={() => setHovered(null)}
            title={meta.label}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: isActive
                ? 'rgba(41, 98, 255, 0.2)'
                : isHovered
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'transparent',
              color: isActive ? '#2962FF' : '#D1D4DC',
              cursor: 'pointer',
              outline: 'none',
              fontSize: '13px',
              transition: 'background 0.12s ease, transform 0.1s ease',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
            }}
          >
            {meta.icon}
          </button>
        );
      })}

      {/* Divider */}
      <div style={{
        width: 1, height: 18, background: 'rgba(255,255,255,0.06)', margin: '0 2px',
      }} />

      {/* Edit favorites button */}
      <button
        onClick={() => setShowEditor(!showEditor)}
        onMouseEnter={() => setHovered('__edit')}
        onMouseLeave={() => setHovered(null)}
        title="Edit favorites"
        style={{
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '5px',
          border: 'none',
          background: showEditor
            ? 'rgba(41, 98, 255, 0.15)'
            : hovered === '__edit'
              ? 'rgba(255,255,255,0.06)'
              : 'transparent',
          color: showEditor ? '#2962FF' : '#787B86',
          cursor: 'pointer', outline: 'none',
          fontSize: '11px', fontWeight: 700,
          transition: 'background 0.12s ease',
        }}
      >
        ✎
      </button>

      {/* Editor dropdown */}
      {showEditor && (
        <div
          style={{
            position: 'absolute',
            top: '100%', left: 0,
            marginTop: 6,
            padding: '8px',
            borderRadius: '10px',
            background: 'rgba(28, 30, 38, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            minWidth: 220,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {catalogEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => toggleFavorite(entry.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px',
                borderRadius: '6px',
                border: entry.isFav
                  ? '1px solid rgba(41, 98, 255, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                background: entry.isFav
                  ? 'rgba(41, 98, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.03)',
                color: entry.isFav ? '#2962FF' : '#787B86',
                cursor: 'pointer', outline: 'none',
                fontSize: '11px',
                fontFamily: '-apple-system, sans-serif',
                transition: 'all 0.12s ease',
              }}
            >
              <span style={{ fontSize: '12px' }}>{entry.icon}</span>
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontSize: '10px',
              }}>
                {entry.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
