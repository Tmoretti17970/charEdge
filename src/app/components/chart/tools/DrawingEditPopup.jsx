import React, { useState, useEffect, useRef, useCallback } from 'react';
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
};

export default function DrawingEditPopup({ drawing, containerRect, engine, onClose }) {
  const popupRef = useRef(null);
  const [color, setColor] = useState(drawing.style?.color || '#2962FF');
  const [lineWidth, setLineWidth] = useState(drawing.style?.lineWidth || 2);
  const [dash, setDash] = useState(drawing.style?.dash || []);
  const [showColorGrid, setShowColorGrid] = useState(false);
  const [points, setPoints] = useState(drawing.points.map(p => ({ ...p })));
  const [showFullSettings, setShowFullSettings] = useState(false);

  // Position popup near the drawing
  const popupX = Math.min(drawing.pixelX + 16, (containerRect?.width || 800) - 300);
  const popupY = Math.max(8, Math.min(drawing.pixelY - 20, (containerRect?.height || 600) - 400));

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    // Delay adding listeners to avoid immediate close from the dblclick event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape, true);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  // Listen for external open-drawing-settings event (Batch 15)
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
    onClose();
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
  const isComplexTool = DrawingSettingsDialog.isComplexTool(drawing.type);

  return (
    <div
      ref={popupRef}
      className="tf-drawing-edit"
      style={{
        position: 'absolute',
        left: popupX,
        top: popupY,
        zIndex: 900,
      }}
    >
      {/* Header */}
      <div className="tf-drawing-edit-header">
        <span className="tf-drawing-edit-title">{toolLabel}</span>
        {/* Batch 15: Gear icon for complex tools → opens full tabbed dialog */}
        {isComplexTool && (
          <button
            className="tf-drawing-edit-action-btn"
            onClick={() => setShowFullSettings(true)}
            title="Open full settings"
            style={{ fontSize: 14, marginRight: 4 }}
          >
            ⚙
          </button>
        )}
        <button className="tf-drawing-edit-close" onClick={onClose}>✕</button>
      </div>

      {/* Style Section */}
      <div className="tf-drawing-edit-section">
        <div className="tf-drawing-edit-row">
          {/* Color */}
          <div style={{ position: 'relative' }}>
            <button
              className="tf-drawing-edit-color-btn"
              onClick={() => setShowColorGrid(!showColorGrid)}
              title="Line Color"
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                background: color,
                border: '2px solid rgba(255,255,255,0.15)',
              }} />
            </button>

            {showColorGrid && (
              <div className="tf-drawing-edit-color-grid">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className="tf-drawing-edit-color-swatch"
                    style={{
                      background: c,
                      border: color === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: color === c ? `0 0 0 2px ${c}40` : 'none',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="tf-drawing-edit-color-input"
                />
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="tf-drawing-edit-sep" />

          {/* Line Width */}
          <div className="tf-drawing-edit-width-group">
            <span className="tf-drawing-edit-label">W</span>
            <input
              type="range"
              min={1} max={5} step={1}
              value={lineWidth}
              onChange={(e) => handleLineWidthChange(parseInt(e.target.value))}
              className="tf-drawing-edit-range"
            />
            <span className="tf-drawing-edit-width-val">{lineWidth}</span>
          </div>

          {/* Separator */}
          <div className="tf-drawing-edit-sep" />

          {/* Dash Pattern */}
          <div style={{ display: 'flex', gap: 1 }}>
            {DASH_OPTIONS.map((dp) => (
              <button
                key={dp.name}
                className="tf-drawing-edit-dash-btn"
                data-active={JSON.stringify(dash) === JSON.stringify(dp.value) || undefined}
                onClick={() => handleDashChange(dp.value)}
                title={dp.name}
              >
                {dp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coordinates Section */}
      <div className="tf-drawing-edit-section">
        <div className="tf-drawing-edit-section-label">COORDINATES</div>
        {points.map((pt, i) => (
          <div key={i} className="tf-drawing-edit-coord-row">
            <span className="tf-drawing-edit-coord-label">P{i + 1}</span>
            <div className="tf-drawing-edit-coord-field">
              <span className="tf-drawing-edit-coord-icon">$</span>
              <input
                type="number"
                value={pt.price >= 1000 ? pt.price.toFixed(0) : pt.price.toFixed(2)}
                onChange={(e) => handlePointChange(i, 'price', e.target.value)}
                className="tf-drawing-edit-coord-input"
                step={pt.price >= 100 ? 1 : 0.01}
              />
            </div>
            <div className="tf-drawing-edit-coord-field">
              <span className="tf-drawing-edit-coord-icon">⏱</span>
              <input
                type="text"
                defaultValue={formatTime(pt.time)}
                onBlur={(e) => {
                  const t = parseTimeInput(e.target.value);
                  if (t) handlePointChange(i, 'time', t);
                }}
                className="tf-drawing-edit-coord-input tf-drawing-edit-coord-time"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="tf-drawing-edit-actions">
        <button className="tf-drawing-edit-action-btn" onClick={handleDuplicate} title="Duplicate">
          ⧉
        </button>
        <button className="tf-drawing-edit-action-btn" onClick={handleToggleLock} title={drawing.locked ? 'Unlock' : 'Lock'}>
          {drawing.locked ? '🔒' : '🔓'}
        </button>
        {/* Task 1.4.18: Cross-TF drawing sync toggle */}
        <button
          className="tf-drawing-edit-action-btn"
          onClick={() => {
            if (engine) {
              const d = engine.drawings.find(d => d.id === drawing.id);
              if (d) {
                d.syncAcrossTimeframes = !d.syncAcrossTimeframes;
                // Trigger re-render
                window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
                  detail: { id: drawing.id, style: {} }
                }));
              }
            }
          }}
          title={drawing.syncAcrossTimeframes ? 'Synced across timeframes — click to disable' : 'Show on current TF only — click to sync across all TFs'}
          style={{
            color: drawing.syncAcrossTimeframes ? '#42A5F5' : undefined,
            fontWeight: drawing.syncAcrossTimeframes ? 700 : undefined,
          }}
        >
          🔗
        </button>
        <div style={{ flex: 1 }} />
        <button className="tf-drawing-edit-action-btn tf-drawing-edit-delete" onClick={handleDelete} title="Delete">
          🗑
        </button>
      </div>
    </div>
  );
}
