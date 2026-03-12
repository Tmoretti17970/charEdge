// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Property Editor
// Floating inline editor for drawing style (color, width, dash, fill).
// Appears when a drawing is selected. TradingView-style UX.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '../../../../constants.js';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';

const PRESET_COLORS = [
  '#2962FF', '#FF6D00', '#EF5350', '#26A69A', '#AB47BC',
  '#00BCD4', '#F44336', '#E91E63', '#9C27B0', '#3F51B5',
  '#009688', '#4CAF50', '#CDDC39', '#FF9800', '#795548',
  '#607D8B', '#FFEB3B', '#FF5722', '#D1D4DC', '#787B86',
];

const _LINE_WIDTHS = [1, 2, 3, 4, 5];

const DASH_PATTERNS = [
  { label: '──', value: [], name: 'Solid' },
  { label: '- -', value: [6, 4], name: 'Dashed' },
  { label: '· ·', value: [2, 3], name: 'Dotted' },
  { label: '-·-', value: [8, 4, 2, 4], name: 'Dash-Dot' },
];

export default function DrawingPropertyEditor() {
  const selectedDrawingId = useChartToolsStore((s) => s.selectedDrawingId);
  const drawings = useChartToolsStore((s) => s.drawings);
  const setDrawings = useChartToolsStore((s) => s.setDrawings);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const containerRef = useRef(null);

  const drawing = drawings.find((d) => d.id === selectedDrawingId);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowColorPicker(false);
        setShowFillPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateStyle = useCallback((key, value) => {
    if (!selectedDrawingId) return;
    // Also update via DrawingEngine event for real-time canvas refresh
    window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
      detail: { id: selectedDrawingId, style: { [key]: value } }
    }));
    // Update store
    setDrawings(
      drawings.map((d) =>
        d.id === selectedDrawingId
          ? { ...d, style: { ...d.style, [key]: value } }
          : d
      )
    );
  }, [selectedDrawingId, drawings, setDrawings]);

  const handleDelete = useCallback(() => {
    if (!selectedDrawingId) return;
    window.dispatchEvent(new CustomEvent('charEdge:delete-specific', { detail: selectedDrawingId }));
  }, [selectedDrawingId]);

  const handleDuplicate = useCallback(() => {
    if (!drawing) return;
    const newDrawing = {
      ...drawing,
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      points: drawing.points.map(p => ({
        ...p,
        price: p.price * 1.001, // Offset slightly
      })),
      style: { ...drawing.style },
    };
    useChartToolsStore.getState().addDrawing(newDrawing);
  }, [drawing]);

  const handleToggleVisibility = useCallback(() => {
    if (!selectedDrawingId) return;
    window.dispatchEvent(new CustomEvent('charEdge:toggle-visibility', { detail: selectedDrawingId }));
  }, [selectedDrawingId]);

  const handleToggleLock = useCallback(() => {
    if (!selectedDrawingId) return;
    window.dispatchEvent(new CustomEvent('charEdge:toggle-lock', { detail: selectedDrawingId }));
  }, [selectedDrawingId]);

  if (!drawing) return null;

  const style = drawing.style || {};
  const hasFill = style.fillColor !== undefined || ['rect', 'triangle', 'ellipse', 'channel', 'alertzone'].includes(drawing.type);

  return (
    <div
      ref={containerRef}
      className="tf-fade-in"
      style={{
        position: 'absolute',
        bottom: 56,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '5px 8px',
        background: 'rgba(18, 20, 28, 0.82)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        fontSize: 12,
        animation: 'tfDropdownIn 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* ─── Color Picker ─────────────────── */}
      <div style={{ position: 'relative' }}>
        <EditorBtn
          title="Line Color"
          onClick={() => { setShowColorPicker(!showColorPicker); setShowFillPicker(false); }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 4,
            background: style.color || '#2962FF',
            border: '2px solid rgba(255,255,255,0.15)',
          }} />
        </EditorBtn>

        {showColorPicker && (
          <ColorPalette
            selected={style.color}
            onSelect={(c) => { updateStyle('color', c); setShowColorPicker(false); }}
            customColor={customColor}
            onCustomChange={(c) => { setCustomColor(c); updateStyle('color', c); }}
          />
        )}
      </div>

      <Separator />

      {/* ─── Fill Color (shapes only) ────── */}
      {hasFill && (
        <>
          <div style={{ position: 'relative' }}>
            <EditorBtn
              title="Fill Color"
              onClick={() => { setShowFillPicker(!showFillPicker); setShowColorPicker(false); }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: style.fillColor || 'rgba(41, 98, 255, 0.1)',
                border: '2px solid rgba(255,255,255,0.1)',
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', opacity: 0.6 }}>▧</span>
              </div>
            </EditorBtn>

            {showFillPicker && (
              <ColorPalette
                selected={style.fillColor}
                onSelect={(c) => {
                  // Apply with alpha for fill
                  const fillC = c + '1A'; // ~10% alpha
                  updateStyle('fillColor', fillC);
                  setShowFillPicker(false);
                }}
                customColor={customColor}
                onCustomChange={(c) => { setCustomColor(c); updateStyle('fillColor', c + '1A'); }}
              />
            )}
          </div>
          <Separator />
        </>
      )}

      {/* ─── Line Width (range slider) ──── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span style={{ fontSize: 10, color: '#787B86', whiteSpace: 'nowrap' }}>W</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={style.lineWidth || 2}
          onChange={(e) => updateStyle('lineWidth', parseInt(e.target.value))}
          title={`Line Width: ${style.lineWidth || 2}px`}
          style={{
            width: 60,
            height: 4,
            accentColor: '#2962FF',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: 10, color: '#D1D4DC', minWidth: 14, textAlign: 'right' }}>
          {style.lineWidth || 2}
        </span>
      </div>

      <Separator />

      {/* ─── Dash Pattern ────────────────── */}
      <div style={{ display: 'flex', gap: 1 }}>
        {DASH_PATTERNS.map((dp) => (
          <EditorBtn
            key={dp.name}
            active={JSON.stringify(style.dash || []) === JSON.stringify(dp.value)}
            title={dp.name}
            onClick={() => updateStyle('dash', dp.value)}
          >
            <span style={{ fontSize: 10, letterSpacing: 1, color: JSON.stringify(style.dash || []) === JSON.stringify(dp.value) ? C.b : C.t2 }}>
              {dp.label}
            </span>
          </EditorBtn>
        ))}
      </div>

      <Separator />

      {/* ─── Actions ─────────────────────── */}
      <EditorBtn title="Duplicate" onClick={handleDuplicate}>
        <span style={{ fontSize: 13 }}>⧉</span>
      </EditorBtn>
      <EditorBtn
        title={drawing.visible === false ? 'Show' : 'Hide'}
        onClick={handleToggleVisibility}
        active={drawing.visible === false}
      >
        <span style={{ fontSize: 13, opacity: drawing.visible === false ? 0.4 : 1 }}>
          {drawing.visible === false ? '🙈' : '👁'}
        </span>
      </EditorBtn>
      <EditorBtn
        title={drawing.locked ? 'Unlock' : 'Lock'}
        onClick={handleToggleLock}
        active={drawing.locked}
      >
        <span style={{ fontSize: 13 }}>{drawing.locked ? '🔒' : '🔓'}</span>
      </EditorBtn>
      <EditorBtn title="Delete" onClick={handleDelete}>
        <span style={{ fontSize: 13, color: C.r || '#EF5350' }}>🗑</span>
      </EditorBtn>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function EditorBtn({ children, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 7px',
        background: active ? 'rgba(41, 98, 255, 0.15)' : 'transparent',
        border: active ? '1px solid rgba(41, 98, 255, 0.3)' : '1px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        minWidth: 30,
        minHeight: 30,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', margin: '0 2px', flexShrink: 0 }} />;
}

function ColorPalette({ selected, onSelect, customColor, onCustomChange }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8,
      background: 'rgba(18, 20, 28, 0.92)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 10,
      zIndex: 600,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
      animation: 'tfDropdownIn 0.15s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 5,
        marginBottom: 8,
      }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            style={{
              width: 26, height: 26,
              borderRadius: 7,
              background: c,
              border: selected === c ? '2px solid #fff' : '2px solid transparent',
              boxShadow: selected === c ? `0 0 0 2px ${c}40, inset 0 0 0 1px rgba(255,255,255,0.3)` : 'none',
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>
      <input
        type="color"
        value={customColor || selected || '#2962FF'}
        onChange={(e) => onCustomChange(e.target.value)}
        style={{
          width: '100%',
          height: 28,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 7,
          cursor: 'pointer',
          background: 'rgba(30,34,45,0.8)',
        }}
      />
    </div>
  );
}
