// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingQuickEditor  (Sprint 4 / CSS Module Sprint 23)
// Single, consolidated editing surface for selected drawings.
// Compact quick-bar by default; gear toggle expands full editor
// (coordinates, full settings dialog bridge).
// Replaces both FloatingDrawingBar + DrawingEditPopup.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TOOL_LABELS } from '../../../../shared/drawingToolRegistry';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import useAlertStore from '../../../../state/useAlertStore';
import { useChartStore } from '../../../../state/useChartStore';
import DrawingSettingsDialog from '../panels/DrawingSettingsDialog.jsx';
import s from './DrawingQuickEditor.module.css';

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
  const [userPosition, setUserPosition] = useState(null);
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
    setUserPosition(null);
  }, [drawing?.id]);

  // ─── Drag handlers (document-level for smooth tracking) ────
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const newVpX = e.clientX - dragOffsetRef.current.mouseX;
      const newVpY = e.clientY - dragOffsetRef.current.mouseY;
      const nx = newVpX - dragOffsetRef.current.corrX;
      const ny = newVpY - dragOffsetRef.current.corrY;
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
  const setToolStyleMemory = useChartToolsStore((st) => st.setToolStyleMemory);
  const updateStyle = useCallback((patch) => {
    if (!engine || !drawing) return;
    engine.updateStyle(drawing.id, patch);
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
      className={s.editor}
      data-expanded={expanded || undefined}
      data-visible={visible}
      data-dragging={isDragging || undefined}
      style={{
        left: userPosition ? userPosition.x : pos.x,
        top: userPosition ? userPosition.y : pos.y,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Quick Bar (always visible) ─── */}
      <div className={s.quickBar} data-expanded={expanded || undefined}>
        {/* ─── Drag Handle ─── */}
        <div
          onMouseDown={handleDragStart}
          title="Drag to reposition"
          className={s.dragHandle}
          data-dragging={isDragging || undefined}
        >
          {[0, 1, 2].map(i => (
            <div key={i} className={s.gripRow}>
              <div className={s.gripDot} />
              <div className={s.gripDot} />
            </div>
          ))}
        </div>
        <Divider />
        {/* Color dots */}
        <div className={s.colorDotsRow}>
          {PRESET_COLORS.slice(0, 6).map(c => (
            <button
              key={c}
              onClick={() => updateStyle({ color: c })}
              title={c}
              className={s.colorDot}
              data-selected={currentColor === c || undefined}
              style={{
                background: c,
                boxShadow: currentColor === c ? `0 0 6px ${c}66` : 'none',
              }}
            />
          ))}
          <button
            onClick={() => { setShowColorPicker(!showColorPicker); setShowFillPicker(false); }}
            title="More colors"
            className={s.colorWheelBtn}
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
        <span className={s.widthDisplay}>
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
        <div className={s.expandedPanel}>
          {/* Tool label */}
          <div className={s.toolLabelRow}>
            <span className={s.toolLabelName}>{toolLabel}</span>
            <button
              onClick={() => setShowFullSettings(true)}
              title="Full settings"
              className={s.fullSettingsBtn}
            >
              Full Settings →
            </button>
          </div>

          {/* Fill color (shapes only) */}
          {hasFill && (
            <div className={s.fillRow}>
              <span className={s.fillLabel}>Fill</span>
              <div className={s.fillBtnWrap}>
                <button
                  onClick={() => { setShowFillPicker(!showFillPicker); setShowColorPicker(false); }}
                  className={s.fillBtn}
                  style={{ background: style.fillColor || 'rgba(41,98,255,0.1)' }}
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
          <div className={s.dashRow}>
            {DASH_OPTIONS.map((dp) => {
              const active = JSON.stringify(currentDash) === JSON.stringify(dp.value);
              return (
                <button
                  key={dp.name}
                  onClick={() => updateStyle({ dash: dp.value })}
                  title={dp.name}
                  className={s.dashBtn}
                  data-active={active || undefined}
                >
                  {dp.label}
                </button>
              );
            })}
          </div>

          {/* Coordinates (collapsible) */}
          <div className={s.coordSection}>
            <button
              onClick={() => setShowCoords(!showCoords)}
              className={s.coordToggle}
            >
              <span className={s.coordChevron} data-open={showCoords || undefined}>▸</span>
              COORDINATES
            </button>
            {showCoords && (
              <div className={s.coordBody}>
                {points.map((pt, i) => (
                  <div key={i} className={s.coordRow}>
                    <span className={s.coordLabel}>P{i + 1}</span>
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
          <div className={s.actionRow}>
            <ActionBtn onClick={handleDuplicate} title="Duplicate" icon="⧉" />
            <ActionBtn
              onClick={handleToggleVisibility}
              title={drawing.visible === false ? 'Show' : 'Hide'}
              icon={drawing.visible === false ? '🙈' : '👁'}
              data-hidden={drawing.visible === false || undefined}
            />
            <ActionBtn
              onClick={handleToggleSync}
              title={drawing.syncAcrossTimeframes ? 'Synced' : 'Sync all TFs'}
              icon="🔗"
              data-synced={drawing.syncAcrossTimeframes || undefined}
            />
            <div className={s.actionSpacer} />
            <ActionBtn onClick={handleDelete} title="Delete" icon="🗑" data-danger />
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
  return <div className={s.divider} />;
}

function QBtn({ children, onClick, title, active, danger, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className={s.qBtn}
      data-active={active || undefined}
      data-danger={danger || undefined}
    >
      {children}
    </button>
  );
}

function ActionBtn({ onClick, title, icon, ...rest }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={s.actionBtn}
      {...rest}
    >
      {icon}
    </button>
  );
}

function CoordField({ icon, value, onChange, type = 'text', step, onBlur }) {
  const handleChange = onBlur ? undefined : (e) => onChange(e.target.value);
  const handleBlurCb = onBlur ? (e) => onChange(e.target.value) : undefined;
  return (
    <div className={s.coordField}>
      <span className={s.coordFieldIcon}>{icon}</span>
      <input
        type={type}
        defaultValue={onBlur ? value : undefined}
        value={onBlur ? undefined : value}
        onChange={handleChange}
        onBlur={handleBlurCb}
        step={step}
        className={s.coordFieldInput}
      />
    </div>
  );
}

function ColorGrid({ selected, onSelect, popoverStyle = {} }) {
  return (
    <div className={s.colorGrid} style={popoverStyle}>
      <div className={s.colorGridSwatches}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={s.colorGridSwatch}
            data-selected={selected === c || undefined}
            style={{
              background: c,
              boxShadow: selected === c ? `0 0 0 2px ${c}40` : 'none',
            }}
          />
        ))}
      </div>
      <input
        type="color"
        value={selected || '#2962FF'}
        onChange={(e) => onSelect(e.target.value)}
        className={s.colorGridInput}
      />
    </div>
  );
}
