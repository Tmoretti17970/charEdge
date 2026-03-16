// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingQuickEditor  (Sprint 4)
// Single, consolidated editing surface for selected drawings.
// Compact quick-bar by default; gear toggle expands full editor
// (coordinates, full settings dialog bridge).
// Replaces both FloatingDrawingBar + DrawingEditPopup.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DrawingSettingsDialog from '../panels/DrawingSettingsDialog.jsx';
import { TOOL_LABELS } from '../../../../shared/drawingToolRegistry';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import useAlertStore from '../../../../state/useAlertStore';
import { useChartStore } from '../../../../state/useChartStore';
import { listPresets, savePreset, applyPreset } from '../../../../state/chart/drawingPresets';

// ─── Constants ───────────────────────────────────────────────────

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

const WIDTHS = [1, 1.5, 2, 3, 4, 5];

const FILL_TOOLS = new Set([
  'rect', 'triangle', 'ellipse', 'channel', 'alertzone',
  'parallelchannel', 'pitchfork', 'callout', 'note',
  'measure', 'pricerange', 'daterange',
]);

// Sprint 13: Drawing types that support alert creation
const ALERTABLE_TOOLS = new Set([
  'hline', 'trendline', 'ray', 'extendedline', 'hray',
  'channel', 'parallelchannel',
]);

// ─── Main Component ──────────────────────────────────────────────

export default function DrawingQuickEditor({ engine, drawing, canvasRect, onClose }) {
  const editorRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#2962FF');
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [points, setPoints] = useState([]);

  // ─── Drag-to-reposition state ──────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [userPosition, setUserPosition] = useState(null); // { x, y } when user has dragged
  const dragOffsetRef = useRef({ mouseX: 0, mouseY: 0, corrX: 0, corrY: 0 });

  // Sync points from drawing
  useEffect(() => {
    if (drawing?.points) setPoints(drawing.points.map(p => ({ ...p })));
  }, [drawing?.id]);

  // Animate entry
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [drawing?.id]);

  // Reset expansion and drag position when drawing changes
  useEffect(() => {
    setExpanded(false);
    setShowCoords(false);
    setShowColorPicker(false);
    setShowFillPicker(false);
    setShowFullSettings(false);
    setUserPosition(null); // Reset to auto-position
  }, [drawing?.id]);

  // ─── Drag handlers (document-level for smooth tracking) ────
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      // Convert viewport mouse position to CSS coordinate space
      const newVpX = e.clientX - dragOffsetRef.current.mouseX;
      const newVpY = e.clientY - dragOffsetRef.current.mouseY;
      const nx = newVpX - dragOffsetRef.current.corrX;
      const ny = newVpY - dragOffsetRef.current.corrY;
      // Clamp within viewport
      const el = editorRef.current;
      const w = el?.offsetWidth || 360;
      const h = el?.offsetHeight || 40;
      setUserPosition({
        x: Math.max(4, Math.min(window.innerWidth - w - 4, nx)),
        y: Math.max(4, Math.min(window.innerHeight - h - 4, ny)),
      });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Compute correction: difference between actual viewport position
    // and CSS left/top. Parent transforms can cause these to diverge.
    const cssLeft = parseFloat(el.style.left) || 0;
    const cssTop = parseFloat(el.style.top) || 0;
    dragOffsetRef.current = {
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
      corrX: rect.left - cssLeft,
      corrY: rect.top - cssTop,
    };
    setIsDragging(true);
  }, []);

  // Current style
  const style = drawing?.style || {};
  const currentColor = style.color || '#2962FF';
  const currentWidth = style.lineWidth || 2;
  const currentDash = style.dash || [];
  const isLocked = drawing?.locked || false;

  // Position — above the selected drawing
  const pos = useMemo(() => {
    if (!engine || !canvasRect) return null;
    const bounds = engine.getSelectedBounds?.();
    if (!bounds) return null;

    const barWidth = expanded ? 300 : 360;
    const midX = canvasRect.left + (bounds.left + bounds.right) / 2;
    const topY = canvasRect.top + bounds.top;

    let x = midX - barWidth / 2;
    let y = topY - 52;

    x = Math.max(8, Math.min(window.innerWidth - barWidth - 8, x));
    y = Math.max(8, y);

    if (y < 8) {
      y = canvasRect.top + bounds.bottom + 12;
    }
    return { x, y };
  }, [engine, canvasRect, drawing?.id, engine?.version, expanded]);

  // Style update helper — also persists per-tool style memory (Sprint 7)
  const setToolStyleMemory = useChartToolsStore((s) => s.setToolStyleMemory);
  const updateStyle = useCallback((patch) => {
    if (!engine || !drawing) return;
    engine.updateStyle(drawing.id, patch);
    // Persist to per-tool memory (store + engine)
    const merged = { ...drawing.style, ...patch };
    const memoryStyle = { color: merged.color, lineWidth: merged.lineWidth, dash: merged.dash, ...(merged.fillColor ? { fillColor: merged.fillColor } : {}) };
    setToolStyleMemory(drawing.type, memoryStyle);
    engine.setToolStyleMemory?.(drawing.type, memoryStyle);
  }, [engine, drawing, setToolStyleMemory]);

  // Close on click outside
  useEffect(() => {
    if (!drawing) return;
    const handler = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        if (expanded) setExpanded(false);
        else if (showColorPicker) setShowColorPicker(false);
        else if (showFillPicker) setShowFillPicker(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [drawing, expanded, showColorPicker, showFillPicker]);

  // Escape key closes expansion first, then deselects
  useEffect(() => {
    if (!drawing) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showFullSettings) { setShowFullSettings(false); e.stopPropagation(); }
        else if (expanded) { setExpanded(false); e.stopPropagation(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [drawing, expanded, showFullSettings]);

  // Listen for external open-drawing-settings events
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.id === drawing?.id) setShowFullSettings(true);
    };
    window.addEventListener('charEdge:open-drawing-settings', handler);
    return () => window.removeEventListener('charEdge:open-drawing-settings', handler);
  }, [drawing?.id]);

  if (!drawing || !pos) return null;

  // Full settings dialog takeover
  if (showFullSettings) {
    return (
      <DrawingSettingsDialog
        drawing={drawing}
        engine={engine}
        onClose={() => { setShowFullSettings(false); onClose?.(); }}
      />
    );
  }

  const dashStr = JSON.stringify(currentDash);
  const currentStyleIdx = DASH_OPTIONS.findIndex(o => JSON.stringify(o.value) === dashStr);
  const toolLabel = TOOL_LABELS[drawing.type] || drawing.type;
  const hasFill = FILL_TOOLS.has(drawing.type);

  // ─── Handlers ────────────────────────────────────────────────
  const handleDelete = () => { engine?.removeDrawing(drawing.id); onClose?.(); };
  const handleDuplicate = () => { engine?.duplicateDrawing(drawing.id); onClose?.(); };
  const handleToggleLock = () => engine?.toggleLock(drawing.id);
  const handleToggleVisibility = () => {
    window.dispatchEvent(new CustomEvent('charEdge:toggle-visibility', { detail: drawing.id }));
  };
  const handleToggleSync = () => {
    const d = engine?.drawings?.find(d => d.id === drawing.id);
    if (d) {
      d.syncAcrossTimeframes = !d.syncAcrossTimeframes;
      window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
        detail: { id: drawing.id, style: {} },
      }));
    }
  };

  // Sprint 13: Create alert from drawing
  const symbol = useChartStore.getState()?.symbol || 'UNKNOWN';
  const handleCreateAlert = () => {
    if (!drawing?.points?.[0]) return;
    const price = drawing.points[0].price;
    const alertStore = useAlertStore.getState();
    alertStore.addAlert({
      symbol: symbol.toUpperCase(),
      condition: 'cross_above',
      price,
      note: `[Drawing] ${TOOL_LABELS[drawing.type] || drawing.type} alert`,
      repeating: true,
      style: 'price',
      soundType: 'price',
    });
    // Mark drawing as having an alert
    if (!drawing.meta) drawing.meta = {};
    drawing.meta._alertPrice = price;
    window.dispatchEvent(new CustomEvent('charEdge:drawing-alert-created', {
      detail: { drawingId: drawing.id, price, symbol },
    }));
  };
  const handlePointChange = (idx, field, value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const newPts = [...points];
    newPts[idx] = { ...newPts[idx], [field]: num };
    setPoints(newPts);
    const d = engine?.drawings?.find(d => d.id === drawing.id);
    if (d?.points[idx]) {
      d.points[idx] = { ...newPts[idx] };
      window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
        detail: { id: drawing.id, style: {} },
      }));
    }
  };
  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const parseTimeInput = (str) => {
    const d = new Date(str.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  return (
    <div
      ref={editorRef}
      style={{
        position: 'fixed',
        left: userPosition ? userPosition.x : pos.x,
        top: userPosition ? userPosition.y : pos.y,
        zIndex: 9999,
        minWidth: expanded ? 280 : undefined,
        maxWidth: expanded ? 340 : undefined,
        borderRadius: expanded ? 14 : 10,
        background: 'rgba(24, 26, 34, 0.92)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
        pointerEvents: 'auto',
        userSelect: 'none',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        fontSize: 12,
        color: '#D1D4DC',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Quick Bar (always visible) ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: expanded ? '5px 6px 4px' : '4px 6px',
        borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
        {/* ─── Drag Handle ─── */}
        <div
          onMouseDown={handleDragStart}
          title="Drag to reposition"
          style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            padding: '4px 4px 4px 2px',
            cursor: isDragging ? 'grabbing' : 'grab',
            opacity: 0.4, transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D4DC' }} />
          </div>
        </div>
        <Divider />
        {/* Color dots */}
        <div style={{ display: 'flex', gap: 2 }}>
          {PRESET_COLORS.slice(0, 6).map(c => (
            <button
              key={c}
              onClick={() => updateStyle({ color: c })}
              title={c}
              style={{
                width: 16, height: 16, borderRadius: '50%', background: c,
                border: currentColor === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer', outline: 'none',
                transition: 'transform 0.12s, border-color 0.15s',
                transform: currentColor === c ? 'scale(1.15)' : 'scale(1)',
                boxShadow: currentColor === c ? `0 0 6px ${c}66` : 'none',
              }}
            />
          ))}
          {/* Expand color picker */}
          <button
            onClick={() => { setShowColorPicker(!showColorPicker); setShowFillPicker(false); }}
            title="More colors"
            style={{
              width: 16, height: 16, borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              border: '2px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', outline: 'none',
            }}
          />
        </div>

        <Divider />

        {/* Width −/+ */}
        <QBtn
          title="Thinner"
          disabled={currentWidth <= WIDTHS[0]}
          onClick={() => {
            const i = WIDTHS.indexOf(currentWidth);
            if (i > 0) updateStyle({ lineWidth: WIDTHS[i - 1] });
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </QBtn>
        <span style={{ color: '#D1D4DC', fontSize: 10, fontWeight: 600, minWidth: 14, textAlign: 'center' }}>
          {currentWidth}
        </span>
        <QBtn
          title="Thicker"
          onClick={() => {
            const i = WIDTHS.indexOf(currentWidth);
            if (i < WIDTHS.length - 1) updateStyle({ lineWidth: WIDTHS[i + 1] });
            else if (i === -1) updateStyle({ lineWidth: WIDTHS[1] });
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </QBtn>

        <Divider />

        {/* Dash cycle */}
        <QBtn
          title={`Style: ${DASH_OPTIONS[Math.max(0, currentStyleIdx)]?.name}`}
          onClick={() => {
            const next = (currentStyleIdx + 1) % DASH_OPTIONS.length;
            updateStyle({ dash: DASH_OPTIONS[next].value });
          }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14">
            {currentStyleIdx <= 0 ? (
              <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : currentStyleIdx === 1 ? (
              <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
            ) : (
              <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="2" strokeDasharray="1.5 3" strokeLinecap="round" />
            )}
          </svg>
        </QBtn>

        <Divider />

        {/* Lock */}
        <QBtn title={isLocked ? 'Unlock' : 'Lock'} active={isLocked} onClick={handleToggleLock}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d={isLocked ? "M5 6V4.5a2 2 0 014 0V6" : "M5 6V4.5a2 2 0 014 0"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </QBtn>

        {/* Sprint 13: Alert from drawing */}
        {ALERTABLE_TOOLS.has(drawing.type) && (
          <QBtn
            title={drawing.meta?._alertPrice ? 'Alert active' : 'Create alert'}
            active={!!drawing.meta?._alertPrice}
            onClick={handleCreateAlert}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5c-2.2 0-4 1.8-4 4v2.5l-1 1.5h10l-1-1.5V5.5c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 11.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </QBtn>
        )}

        {/* Delete */}
        <QBtn title="Delete" danger onClick={handleDelete}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 4h7M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4.5 4v7a1 1 0 001 1h3a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </QBtn>

        {/* Gear — toggles expanded */}
        <QBtn
          title={expanded ? 'Collapse' : 'More options'}
          active={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.76 2.76l1.06 1.06M10.18 10.18l1.06 1.06M2.76 11.24l1.06-1.06M10.18 3.82l1.06-1.06" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </QBtn>
      </div>

      {/* ─── Color picker popover ─── */}
      {showColorPicker && (
        <ColorGrid
          selected={currentColor}
          onSelect={(c) => { updateStyle({ color: c }); setShowColorPicker(false); }}
        />
      )}

      {/* ─── Expanded panel ─── */}
      {expanded && (
        <div style={{ padding: '0 2px' }}>
          {/* Tool label */}
          <div style={{
            padding: '4px 8px 3px', fontSize: 11, fontWeight: 600,
            color: '#787B86', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ flex: 1 }}>{toolLabel}</span>
            {/* Full settings button */}
            <button
              onClick={() => setShowFullSettings(true)}
              title="Full settings"
              style={{
                background: 'none', border: 'none', color: '#787B86',
                cursor: 'pointer', fontSize: 10, padding: '2px 6px',
                borderRadius: 4, transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#D1D4DC'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#787B86'}
            >
              Full Settings →
            </button>
          </div>

          {/* Fill color (shapes only) */}
          {hasFill && (
            <div style={{
              padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: 10, color: '#787B86' }}>Fill</span>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowFillPicker(!showFillPicker); setShowColorPicker(false); }}
                  style={{
                    width: 20, height: 20, borderRadius: 5,
                    background: style.fillColor || 'rgba(41,98,255,0.1)',
                    border: '2px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer', outline: 'none',
                  }}
                />
                {showFillPicker && (
                  <ColorGrid
                    selected={style.fillColor}
                    onSelect={(c) => {
                      updateStyle({ fillColor: c + '1A' });
                      setShowFillPicker(false);
                    }}
                    popoverStyle={{ bottom: '100%', marginBottom: 6 }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Dash pattern full row */}
          <div style={{ padding: '4px 8px', display: 'flex', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {DASH_OPTIONS.map((dp) => {
              const active = JSON.stringify(currentDash) === JSON.stringify(dp.value);
              return (
                <button
                  key={dp.name}
                  onClick={() => updateStyle({ dash: dp.value })}
                  title={dp.name}
                  style={{
                    padding: '3px 6px',
                    background: active ? 'rgba(41,98,255,0.15)' : 'transparent',
                    border: active ? '1px solid rgba(41,98,255,0.3)' : '1px solid transparent',
                    borderRadius: 6, cursor: 'pointer', fontSize: 10,
                    color: active ? '#2962FF' : '#787B86',
                    letterSpacing: 1, transition: 'all 0.12s',
                  }}
                >
                  {dp.label}
                </button>
              );
            })}
          </div>

          {/* Coordinates (collapsible) */}
          <div style={{ padding: '3px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <button
              onClick={() => setShowCoords(!showCoords)}
              style={{
                background: 'none', border: 'none', color: '#787B86', cursor: 'pointer',
                fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 0', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{
                transform: showCoords ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s', display: 'inline-block',
              }}>▸</span>
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

          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px 5px' }}>
            <ActionBtn onClick={handleDuplicate} title="Duplicate" icon="⧉" />
            <ActionBtn
              onClick={handleToggleVisibility}
              title={drawing.visible === false ? 'Show' : 'Hide'}
              icon={drawing.visible === false ? '🙈' : '👁'}
              style={{ opacity: drawing.visible === false ? 0.5 : 1 }}
            />
            <ActionBtn
              onClick={handleToggleSync}
              title={drawing.syncAcrossTimeframes ? 'Synced' : 'Sync all TFs'}
              icon="🔗"
              style={{ color: drawing.syncAcrossTimeframes ? '#42A5F5' : undefined }}
            />
            <div style={{ flex: 1 }} />
            <ActionBtn onClick={handleDelete} title="Delete" icon="🗑" style={{ color: '#EF5350' }} />
            <ActionBtn
              onClick={() => {
                setToolStyleMemory(drawing.type, null);
                engine.setToolStyleMemory?.(drawing.type, {});
              }}
              title="Reset tool defaults"
              icon="↺"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />;
}

function QBtn({ children, onClick, title, active, danger, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      disabled={disabled}
      style={{
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none',
        background: active
          ? 'rgba(41, 98, 255, 0.2)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: danger
          ? (hovered ? '#FF5252' : '#D1D4DC')
          : active ? '#2962FF' : '#D1D4DC',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'background 0.12s, color 0.12s, transform 0.1s',
        transform: hovered && !disabled ? 'scale(1.08)' : 'scale(1)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ActionBtn({ onClick, title, icon, style = {} }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '3px 5px', background: 'transparent',
        border: '1px solid transparent', borderRadius: 6,
        cursor: 'pointer', fontSize: 12, color: '#D1D4DC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 24, minHeight: 24, transition: 'all 0.12s',
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

function CoordField({ icon, value, onChange, type = 'text', step, onBlur }) {
  const handleChange = onBlur ? undefined : (e) => onChange(e.target.value);
  const handleBlurCb = onBlur ? (e) => onChange(e.target.value) : undefined;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: 'rgba(255,255,255,0.04)', borderRadius: 6,
      padding: '3px 6px', border: '1px solid rgba(255,255,255,0.06)', flex: 1,
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

function ColorGrid({ selected, onSelect, popoverStyle = {} }) {
  return (
    <div style={{
      padding: '8px 8px 6px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      ...popoverStyle,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, marginBottom: 6 }}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            style={{
              width: 20, height: 20, borderRadius: 5, background: c,
              border: selected === c ? '2px solid #fff' : '2px solid transparent',
              boxShadow: selected === c ? `0 0 0 2px ${c}40` : 'none',
              cursor: 'pointer', transition: 'transform 0.1s',
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
          width: '100%', height: 22, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 5, cursor: 'pointer', background: 'rgba(30,34,45,0.8)',
        }}
      />
    </div>
  );
}
