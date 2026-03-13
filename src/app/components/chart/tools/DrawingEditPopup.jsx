// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEditPopup (CONSOLIDATED)
// The SOLE editor for drawing objects. Replaces the old triple-editor
// pattern (DrawingEditPopup + DrawingPropertyEditor + QuickStylePalette).
//
// Features:
//   - Drag-to-move anywhere (clamped to chart area, not over sidebar/header)
//   - Quick style controls (color, fill, width, dash)
//   - Coordinate editing (price + time)
//   - Actions (duplicate, lock, visibility, sync, delete)
//   - Gear icon → opens full DrawingSettingsDialog
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import DrawingSettingsDialog from '../panels/DrawingSettingsDialog.jsx';

const PRESET_COLORS = [
  '#2962FF', '#FF6D00', '#EF5350', '#26A69A', '#AB47BC',
  '#00BCD4', '#F44336', '#E91E63', '#9C27B0', '#3F51B5',
  '#009688', '#4CAF50', '#CDDC39', '#FF9800', '#795548',
  '#607D8B', '#FFEB3B', '#FF5722', '#D1D4DC', '#787B86',
];

const DASH_OPTIONS = [
  { label: '──', value: [], name: 'Solid' },
  { label: '- -', value: [6, 4], name: 'Dashed' },
  { label: '· ·', value: [2, 3], name: 'Dotted' },
  { label: '-·-', value: [8, 4, 2, 4], name: 'Dash-Dot' },
];

const TOOL_LABELS = {
  trendline: 'Trend Line', hline: 'Horizontal Line', vline: 'Vertical Line',
  ray: 'Ray', arrow: 'Arrow', fib: 'Fib Retracement', fibext: 'Fib Extension',
  rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle',
  alertzone: 'Alert Zone', text: 'Text', callout: 'Callout',
  measure: 'Measure', channel: 'Channel', crossline: 'Crossline',
  hray: 'Horizontal Ray', extendedline: 'Extended Line',
  pitchfork: 'Pitchfork', elliott: 'Elliott Wave',
  gannfan: 'Gann Fan', fibtimezone: 'Fib Time Zone',
  longposition: 'Long Position', shortposition: 'Short Position',
  parallelchannel: 'Parallel Channel', polyline: 'Polyline',
  pricerange: 'Price Range', daterange: 'Date Range',
  note: 'Note', signpost: 'Signpost', infoline: 'Info Line',
};

// Tools that support fill color
const FILL_TOOLS = new Set([
  'rect', 'triangle', 'ellipse', 'channel', 'alertzone',
  'parallelchannel', 'pitchfork', 'callout', 'note',
  'measure', 'pricerange', 'daterange',
]);

// ─── Clamping constants ──────────────────────────────────────────
const SIDEBAR_WIDTH = 60;   // Left nav sidebar
const HEADER_HEIGHT = 48;   // Top header bar
const POPUP_MIN_W = 260;
const POPUP_MIN_H = 100;

export default function DrawingEditPopup({ drawing, containerRect, engine, onClose }) {
  const popupRef = useRef(null);
  const [color, setColor] = useState(drawing.style?.color || '#2962FF');
  const [fillColor, setFillColor] = useState(drawing.style?.fillColor || '');
  const [lineWidth, setLineWidth] = useState(drawing.style?.lineWidth || 2);
  const [dash, setDash] = useState(drawing.style?.dash || []);
  const [showColorGrid, setShowColorGrid] = useState(false);
  const [showFillGrid, setShowFillGrid] = useState(false);
  const [points, setPoints] = useState(drawing.points.map(p => ({ ...p })));
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [showCoords, setShowCoords] = useState(false);

  // ─── Drag state ────────────────────────────────────────────────
  const [pos, setPos] = useState(() => ({
    x: Math.min(
      Math.max((drawing.pixelX || 200) + 16, SIDEBAR_WIDTH + 8),
      (containerRect?.width || 800) - POPUP_MIN_W
    ),
    y: Math.max(
      HEADER_HEIGHT + 8,
      Math.min((drawing.pixelY || 200) - 20, (containerRect?.height || 600) - POPUP_MIN_H)
    ),
  }));
  const dragRef = useRef(null); // { startX, startY, origX, origY }

  // ─── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    const handleDragMove = (me) => {
      if (!dragRef.current) return;
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      const maxX = (window.innerWidth || 1200) - POPUP_MIN_W;
      const maxY = (window.innerHeight || 800) - POPUP_MIN_H;
      setPos({
        x: Math.max(SIDEBAR_WIDTH + 8, Math.min(dragRef.current.origX + dx, maxX)),
        y: Math.max(HEADER_HEIGHT + 8, Math.min(dragRef.current.origY + dy, maxY)),
      });
    };

    const handleDragEnd = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [pos.x, pos.y]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape, true);
    }, 80);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  // Listen for external open-drawing-settings event
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.id === drawing.id) setShowFullSettings(true);
    };
    window.addEventListener('charEdge:open-drawing-settings', handler);
    return () => window.removeEventListener('charEdge:open-drawing-settings', handler);
  }, [drawing.id]);

  const updateStyle = useCallback((key, value) => {
    if (!engine || !drawing.id) return;
    engine.updateStyle(drawing.id, { [key]: value });
  }, [engine, drawing.id]);

  const handleColorChange = (c) => {
    setColor(c);
    updateStyle('color', c);
    setShowColorGrid(false);
  };

  const handleFillChange = (c) => {
    const fillC = c + '1A'; // ~10% alpha
    setFillColor(fillC);
    updateStyle('fillColor', fillC);
    setShowFillGrid(false);
  };

  const handleLineWidthChange = (w) => {
    setLineWidth(w);
    updateStyle('lineWidth', w);
  };

  const handleDashChange = (d) => {
    setDash(d);
    updateStyle('dash', d);
  };

  const handlePointChange = (idx, field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    const newPoints = [...points];
    newPoints[idx] = { ...newPoints[idx], [field]: numValue };
    setPoints(newPoints);
    if (engine) {
      const d = engine.drawings.find(d => d.id === drawing.id);
      if (d && d.points[idx]) {
        d.points[idx] = { ...newPoints[idx] };
        window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
          detail: { id: drawing.id, style: {} }
        }));
      }
    }
  };

  const handleDelete = () => {
    if (engine) engine.removeDrawing(drawing.id);
    onClose();
  };

  const handleDuplicate = () => {
    if (engine) engine.duplicateDrawing(drawing.id);
    onClose();
  };

  const handleToggleLock = () => {
    if (engine) engine.toggleLock(drawing.id);
  };

  const handleToggleVisibility = () => {
    window.dispatchEvent(new CustomEvent('charEdge:toggle-visibility', { detail: drawing.id }));
  };

  const handleToggleSync = () => {
    if (engine) {
      const d = engine.drawings.find(d => d.id === drawing.id);
      if (d) {
        d.syncAcrossTimeframes = !d.syncAcrossTimeframes;
        window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
          detail: { id: drawing.id, style: {} }
        }));
      }
    }
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const parseTimeInput = (str) => {
    const d = new Date(str.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  // Show full settings dialog when requested
  if (showFullSettings) {
    return (
      <DrawingSettingsDialog
        drawing={drawing}
        engine={engine}
        onClose={() => { setShowFullSettings(false); onClose(); }}
      />
    );
  }

  const toolLabel = TOOL_LABELS[drawing.type] || drawing.type;
  const hasFill = FILL_TOOLS.has(drawing.type);

  // ─── Styles ────────────────────────────────────────────────────
  const cardStyle = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    zIndex: 950,
    minWidth: POPUP_MIN_W,
    maxWidth: 340,
    background: 'rgba(18, 20, 28, 0.88)',
    backdropFilter: 'blur(28px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontSize: 12,
    color: '#D1D4DC',
    animation: 'tfDropdownIn 0.18s cubic-bezier(0.16,1,0.3,1)',
    userSelect: 'none',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px 6px',
    cursor: 'grab',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px 14px 0 0',
  };

  const sectionStyle = {
    padding: '6px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  };

  return (
    <div ref={popupRef} style={cardStyle}>
      {/* ─── Draggable Header ─────────────────────── */}
      <div style={headerStyle} onMouseDown={handleDragStart}>
        {/* Drag grip icon */}
        <span style={{ fontSize: 10, color: '#555', letterSpacing: 2, marginRight: 2, cursor: 'grab' }}>⠿</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#D1D4DC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {toolLabel}
        </span>
        {/* Gear → full settings */}
        <IconBtn onClick={() => setShowFullSettings(true)} title="Settings" icon="⚙" />
        {/* Close */}
        <IconBtn onClick={onClose} title="Close" icon="✕" style={{ fontSize: 11 }} />
      </div>

      {/* ─── Quick Style Row ──────────────────────── */}
      <div style={sectionStyle}>
        <div style={rowStyle}>
          {/* Color swatch */}
          <div style={{ position: 'relative' }}>
            <SwatchBtn color={color} onClick={() => { setShowColorGrid(!showColorGrid); setShowFillGrid(false); }} title="Line Color" />
            {showColorGrid && (
              <ColorGrid
                selected={color}
                onSelect={handleColorChange}
                style={{ bottom: '100%', marginBottom: 6 }}
              />
            )}
          </div>

          {/* Fill swatch (shapes only) */}
          {hasFill && (
            <div style={{ position: 'relative' }}>
              <SwatchBtn
                color={fillColor || drawing.style?.fillColor || 'rgba(41,98,255,0.1)'}
                onClick={() => { setShowFillGrid(!showFillGrid); setShowColorGrid(false); }}
                title="Fill Color"
                isFill
              />
              {showFillGrid && (
                <ColorGrid
                  selected={fillColor}
                  onSelect={handleFillChange}
                  style={{ bottom: '100%', marginBottom: 6 }}
                />
              )}
            </div>
          )}

          <Sep />

          {/* Line Width */}
          <span style={{ fontSize: 10, color: '#787B86' }}>W</span>
          <input
            type="range"
            min={1} max={5} step={1}
            value={lineWidth}
            onChange={(e) => handleLineWidthChange(parseInt(e.target.value))}
            title={`Width: ${lineWidth}px`}
            style={{ width: 50, height: 3, accentColor: '#2962FF', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: '#D1D4DC', minWidth: 12, textAlign: 'right' }}>{lineWidth}</span>

          <Sep />

          {/* Dash pattern  */}
          <div style={{ display: 'flex', gap: 1 }}>
            {DASH_OPTIONS.map((dp) => {
              const active = JSON.stringify(dash) === JSON.stringify(dp.value);
              return (
                <button
                  key={dp.name}
                  onClick={() => handleDashChange(dp.value)}
                  title={dp.name}
                  style={{
                    padding: '3px 5px',
                    background: active ? 'rgba(41,98,255,0.15)' : 'transparent',
                    border: active ? '1px solid rgba(41,98,255,0.3)' : '1px solid transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 10,
                    color: active ? '#2962FF' : '#787B86',
                    letterSpacing: 1,
                    transition: 'all 0.12s ease',
                  }}
                >
                  {dp.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Collapsible Coordinates ──────────────── */}
      <div style={{ ...sectionStyle, padding: '4px 10px' }}>
        <button
          onClick={() => setShowCoords(!showCoords)}
          style={{
            background: 'none', border: 'none', color: '#787B86', cursor: 'pointer',
            fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 0', width: '100%', textAlign: 'left',
          }}
        >
          <span style={{ transform: showCoords ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
          COORDINATES
        </button>
        {showCoords && (
          <div style={{ marginTop: 4 }}>
            {points.map((pt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#787B86', minWidth: 20 }}>P{i + 1}</span>
                <CoordField
                  icon="$"
                  value={pt.price >= 1000 ? pt.price.toFixed(0) : pt.price.toFixed(2)}
                  onChange={(v) => handlePointChange(i, 'price', v)}
                  step={pt.price >= 100 ? 1 : 0.01}
                  type="number"
                />
                <CoordField
                  icon="⏱"
                  value={formatTime(pt.time)}
                  onChange={(v) => {
                    const t = parseTimeInput(v);
                    if (t) handlePointChange(i, 'time', t);
                  }}
                  type="text"
                  onBlur
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Action Bar ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px' }}>
        <IconBtn onClick={handleDuplicate} title="Duplicate" icon="⧉" />
        <IconBtn
          onClick={handleToggleVisibility}
          title={drawing.visible === false ? 'Show' : 'Hide'}
          icon={drawing.visible === false ? '🙈' : '👁'}
          style={{ opacity: drawing.visible === false ? 0.5 : 1 }}
        />
        <IconBtn
          onClick={handleToggleLock}
          title={drawing.locked ? 'Unlock' : 'Lock'}
          icon={drawing.locked ? '🔒' : '🔓'}
        />
        <IconBtn
          onClick={handleToggleSync}
          title={drawing.syncAcrossTimeframes ? 'Synced — click to unsync' : 'Show on current TF — click to sync all'}
          icon="🔗"
          style={{ color: drawing.syncAcrossTimeframes ? '#42A5F5' : undefined }}
        />
        <div style={{ flex: 1 }} />
        <IconBtn onClick={handleDelete} title="Delete" icon="🗑" style={{ color: '#EF5350' }} />
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function IconBtn({ onClick, title, icon, style = {} }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '4px 6px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 7,
        cursor: 'pointer',
        fontSize: 13,
        color: '#D1D4DC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 26,
        minHeight: 26,
        transition: 'all 0.12s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

function SwatchBtn({ color, onClick, title, isFill }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 3,
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 7,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.12s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 5,
        background: color,
        border: '2px solid rgba(255,255,255,0.12)',
        position: 'relative',
      }}>
        {isFill && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', opacity: 0.5 }}>▧</span>
        )}
      </div>
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.06)', margin: '0 3px', flexShrink: 0 }} />;
}

function CoordField({ icon, value, onChange, type = 'text', step, onBlur }) {
  const handleChange = onBlur
    ? undefined
    : (e) => onChange(e.target.value);
  const handleBlurCb = onBlur
    ? (e) => onChange(e.target.value)
    : undefined;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 6, padding: '3px 6px',
      border: '1px solid rgba(255,255,255,0.06)',
      flex: 1,
    }}>
      <span style={{ fontSize: 10, color: '#787B86' }}>{icon}</span>
      <input
        type={type}
        defaultValue={onBlur ? value : undefined}
        value={onBlur ? undefined : value}
        onChange={handleChange}
        onBlur={handleBlurCb}
        step={step}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: '#D1D4DC', fontSize: 11, width: '100%',
          fontFamily: "'SF Mono', 'Cascadia Code', monospace",
        }}
      />
    </div>
  );
}

function ColorGrid({ selected, onSelect, style = {} }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(18, 20, 28, 0.94)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 10,
      zIndex: 960,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
      animation: 'tfDropdownIn 0.12s cubic-bezier(0.16,1,0.3,1)',
      ...style,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 8 }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: c,
              border: selected === c ? '2px solid #fff' : '2px solid transparent',
              boxShadow: selected === c ? `0 0 0 2px ${c}40` : 'none',
              cursor: 'pointer',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>
      <input
        type="color"
        value={selected || '#2962FF'}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          width: '100%', height: 26, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, cursor: 'pointer', background: 'rgba(30,34,45,0.8)',
        }}
      />
    </div>
  );
}
