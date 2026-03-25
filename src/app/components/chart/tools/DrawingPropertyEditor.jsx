// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Property Editor
// Floating inline editor for drawing style (color, width, dash, fill).
// Appears when a drawing is selected. TradingView-style UX.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import s from './DrawingPropertyEditor.module.css';

const PRESET_COLORS = [
  '#2962FF',
  '#FF6D00',
  '#EF5350',
  '#26A69A',
  '#AB47BC',
  '#00BCD4',
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#3F51B5',
  '#009688',
  '#4CAF50',
  '#CDDC39',
  '#FF9800',
  '#795548',
  '#607D8B',
  '#FFEB3B',
  '#FF5722',
  '#D1D4DC',
  '#787B86',
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

  const updateStyle = useCallback(
    (key, value) => {
      if (!selectedDrawingId) return;
      // Also update via DrawingEngine event for real-time canvas refresh
      window.dispatchEvent(
        new CustomEvent('charEdge:update-drawing-style', {
          detail: { id: selectedDrawingId, style: { [key]: value } },
        }),
      );
      // Update store
      setDrawings(
        drawings.map((d) => (d.id === selectedDrawingId ? { ...d, style: { ...d.style, [key]: value } } : d)),
      );
    },
    [selectedDrawingId, drawings, setDrawings],
  );

  const handleDelete = useCallback(() => {
    if (!selectedDrawingId) return;
    window.dispatchEvent(new CustomEvent('charEdge:delete-specific', { detail: selectedDrawingId }));
  }, [selectedDrawingId]);

  const handleDuplicate = useCallback(() => {
    if (!drawing) return;
    const newDrawing = {
      ...drawing,
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      points: drawing.points.map((p) => ({
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
  const hasFill =
    style.fillColor !== undefined || ['rect', 'triangle', 'ellipse', 'channel', 'alertzone'].includes(drawing.type);

  return (
    <div ref={containerRef} className={`tf-fade-in ${s.toolbar}`}>
      {/* ─── Color Picker ─────────────────── */}
      <div className={s.pickerWrap}>
        <EditorBtn
          title="Line Color"
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowFillPicker(false);
          }}
        >
          <div className={s.colorSwatch} style={{ '--swatch-bg': style.color || '#2962FF' }} />
        </EditorBtn>

        {showColorPicker && (
          <ColorPalette
            selected={style.color}
            onSelect={(c) => {
              updateStyle('color', c);
              setShowColorPicker(false);
            }}
            customColor={customColor}
            onCustomChange={(c) => {
              setCustomColor(c);
              updateStyle('color', c);
            }}
          />
        )}
      </div>

      <Separator />

      {/* ─── Fill Color (shapes only) ────── */}
      {hasFill && (
        <>
          <div className={s.pickerWrap}>
            <EditorBtn
              title="Fill Color"
              onClick={() => {
                setShowFillPicker(!showFillPicker);
                setShowColorPicker(false);
              }}
            >
              <div className={s.fillSwatch} style={{ '--swatch-bg': style.fillColor || 'rgba(41, 98, 255, 0.1)' }}>
                <span className={s.fillIcon}>▧</span>
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
                onCustomChange={(c) => {
                  setCustomColor(c);
                  updateStyle('fillColor', c + '1A');
                }}
              />
            )}
          </div>
          <Separator />
        </>
      )}

      {/* ─── Line Width (range slider) ──── */}
      <div className={s.widthRow}>
        <span className={s.widthLabel}>W</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={style.lineWidth || 2}
          onChange={(e) => updateStyle('lineWidth', parseInt(e.target.value))}
          title={`Line Width: ${style.lineWidth || 2}px`}
          className={s.widthSlider}
        />
        <span className={s.widthValue}>{style.lineWidth || 2}</span>
      </div>

      <Separator />

      {/* ─── Dash Pattern ────────────────── */}
      <div className={s.dashRow}>
        {DASH_PATTERNS.map((dp) => (
          <EditorBtn
            key={dp.name}
            active={JSON.stringify(style.dash || []) === JSON.stringify(dp.value)}
            title={dp.name}
            onClick={() => updateStyle('dash', dp.value)}
          >
            <span
              className={s.dashLabel}
              data-active={JSON.stringify(style.dash || []) === JSON.stringify(dp.value) ? 'true' : undefined}
            >
              {dp.label}
            </span>
          </EditorBtn>
        ))}
      </div>

      <Separator />

      {/* ─── Actions ─────────────────────── */}
      <EditorBtn title="Duplicate" onClick={handleDuplicate}>
        <span className={s.actionEmoji}>⧉</span>
      </EditorBtn>
      <EditorBtn
        title={drawing.visible === false ? 'Show' : 'Hide'}
        onClick={handleToggleVisibility}
        active={drawing.visible === false}
      >
        <span className={`${s.actionEmoji} ${drawing.visible === false ? s.actionDimmed : ''}`}>
          {drawing.visible === false ? '🙈' : '👁'}
        </span>
      </EditorBtn>
      <EditorBtn title={drawing.locked ? 'Unlock' : 'Lock'} onClick={handleToggleLock} active={drawing.locked}>
        <span className={s.actionEmoji}>{drawing.locked ? '🔒' : '🔓'}</span>
      </EditorBtn>
      <EditorBtn title="Delete" onClick={handleDelete}>
        <span className={`${s.actionEmoji} ${s.actionDanger}`}>🗑</span>
      </EditorBtn>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function EditorBtn({ children, active, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className={s.editorBtn} data-active={active || undefined}>
      {children}
    </button>
  );
}

function Separator() {
  return <div className={s.separator} />;
}

function ColorPalette({ selected, onSelect, customColor, onCustomChange }) {
  return (
    <div className={s.palette}>
      <div className={s.paletteGrid}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={s.paletteSwatch}
            style={{
              '--swatch-bg': c,
              ...(selected === c ? { '--swatch-glow': c + '40' } : {}),
            }}
            data-active={selected === c ? 'true' : undefined}
          />
        ))}
      </div>
      <input
        type="color"
        value={customColor || selected || '#2962FF'}
        onChange={(e) => onCustomChange(e.target.value)}
        className={s.customColorInput}
      />
    </div>
  );
}
