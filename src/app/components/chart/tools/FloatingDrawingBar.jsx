// ═══════════════════════════════════════════════════════════════════
// charEdge — Floating Drawing Action Bar
// Apple-style glassmorphism toolbar that appears above the selected
// drawing. Provides quick access to color, width, style, lock,
// delete, and settings.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const PRESET_COLORS = [
  '#2962FF', '#EF5350', '#26A69A', '#FF9800', '#AB47BC', '#78909C',
];

const LINE_STYLES = [
  { id: 'solid', dash: [], label: 'Solid' },
  { id: 'dashed', dash: [6, 4], label: 'Dashed' },
  { id: 'dotted', dash: [2, 3], label: 'Dotted' },
];

const WIDTHS = [1, 1.5, 2, 3, 4, 5];

export default function FloatingDrawingBar({ engine, drawing, canvasRect, onOpenSettings }) {
  const barRef = useRef(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#2962FF');
  const [visible, setVisible] = useState(false);

  // Animation entry
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [drawing?.id]);

  // Current style
  const style = drawing?.style || {};
  const currentColor = style.color || '#2962FF';
  const currentWidth = style.lineWidth || 2;
  const currentDash = style.dash || [];
  const isLocked = drawing?.locked || false;

  // Compute position — above the selected drawing
  const pos = useMemo(() => {
    if (!engine || !canvasRect) return null;
    const bounds = engine.getSelectedBounds();
    if (!bounds) return null;

    const barWidth = 320;
    const midX = canvasRect.left + (bounds.left + bounds.right) / 2;
    const topY = canvasRect.top + bounds.top;

    let x = midX - barWidth / 2;
    let y = topY - 52;

    // Clamp to viewport
    x = Math.max(8, Math.min(window.innerWidth - barWidth - 8, x));
    y = Math.max(8, y);

    // If bar would overlap the drawing, position below instead
    if (y < 8) {
      y = canvasRect.top + bounds.bottom + 12;
    }

    return { x, y };
  }, [engine, canvasRect, drawing?.id, engine?.version]);

  // Update style helper
  const updateStyle = useCallback((patch) => {
    if (!engine || !drawing) return;
    engine.updateStyle(drawing.id, patch);
  }, [engine, drawing]);

  // Close color picker on click outside
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showColorPicker]);

  if (!drawing || !pos) return null;

  // Determine current line style index
  const dashStr = JSON.stringify(currentDash);
  const currentStyleIdx = LINE_STYLES.findIndex(ls => JSON.stringify(ls.dash) === dashStr);

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 6px',
        borderRadius: '10px',
        background: 'rgba(28, 30, 38, 0.88)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Color dots ── */}
      <div style={{ display: 'flex', gap: '3px', padding: '0 4px' }}>
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            onClick={() => updateStyle({ color })}
            title={color}
            style={{
              width: 18, height: 18,
              borderRadius: '50%',
              background: color,
              border: currentColor === color
                ? '2px solid #fff'
                : '2px solid transparent',
              cursor: 'pointer',
              outline: 'none',
              transition: 'transform 0.12s ease, border-color 0.15s ease',
              transform: currentColor === color ? 'scale(1.15)' : 'scale(1)',
              boxShadow: currentColor === color ? `0 0 8px ${color}66` : 'none',
            }}
          />
        ))}
        {/* Custom color trigger */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Custom color"
          style={{
            width: 18, height: 18,
            borderRadius: '50%',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: '2px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            outline: 'none',
            position: 'relative',
          }}
        />
      </div>

      {/* Custom color input popover */}
      {showColorPicker && (
        <div style={{
          position: 'absolute', top: '100%', left: 8, marginTop: 8,
          padding: '12px', borderRadius: '10px',
          background: 'rgba(28, 30, 38, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          zIndex: 10000,
        }}>
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              updateStyle({ color: e.target.value });
            }}
            style={{
              width: 120, height: 100,
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', background: 'transparent',
            }}
          />
        </div>
      )}

      <Divider />

      {/* ── Line width ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
        <IconBtn
          title="Thinner"
          onClick={() => {
            const idx = WIDTHS.indexOf(currentWidth);
            if (idx > 0) updateStyle({ lineWidth: WIDTHS[idx - 1] });
          }}
          disabled={currentWidth <= WIDTHS[0]}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="3" y1="7" x2="11" y2="7"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </IconBtn>
        <span style={{
          color: '#D1D4DC', fontSize: '11px', fontWeight: 600,
          minWidth: 20, textAlign: 'center', fontFamily: '-apple-system, sans-serif',
        }}>
          {currentWidth}
        </span>
        <IconBtn
          title="Thicker"
          onClick={() => {
            const idx = WIDTHS.indexOf(currentWidth);
            if (idx < WIDTHS.length - 1) updateStyle({ lineWidth: WIDTHS[idx + 1] });
            else if (idx === -1) updateStyle({ lineWidth: WIDTHS[1] });
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="3" y1="7" x2="11" y2="7"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </IconBtn>
      </div>

      <Divider />

      {/* ── Line style toggle ── */}
      <IconBtn
        title={`Line style: ${LINE_STYLES[Math.max(0, currentStyleIdx)]?.label}`}
        onClick={() => {
          const next = (currentStyleIdx + 1) % LINE_STYLES.length;
          updateStyle({ dash: LINE_STYLES[next].dash });
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
      </IconBtn>

      <Divider />

      {/* ── Lock ── */}
      <IconBtn
        title={isLocked ? 'Unlock' : 'Lock'}
        onClick={() => engine.toggleLock(drawing.id)}
        active={isLocked}
      >
        {isLocked ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 6V4.5a2 2 0 014 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 6V4.5a2 2 0 014 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </IconBtn>

      {/* ── Delete ── */}
      <IconBtn
        title="Delete"
        onClick={() => engine.removeDrawing(drawing.id)}
        danger
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 4h7M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4.5 4v7a1 1 0 001 1h3a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </IconBtn>

      {/* ── Settings ── */}
      <IconBtn
        title="Settings"
        onClick={() => onOpenSettings?.(drawing)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.76 2.76l1.06 1.06M10.18 10.18l1.06 1.06M2.76 11.24l1.06-1.06M10.18 3.82l1.06-1.06" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </IconBtn>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{
      width: 1, height: 20,
      background: 'rgba(255, 255, 255, 0.08)',
      margin: '0 3px',
    }} />
  );
}

function IconBtn({ children, onClick, title, active, danger, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      disabled={disabled}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px',
        border: 'none',
        background: active
          ? 'rgba(41, 98, 255, 0.2)'
          : hovered
            ? 'rgba(255, 255, 255, 0.08)'
            : 'transparent',
        color: danger
          ? (hovered ? '#FF5252' : '#D1D4DC')
          : active
            ? '#2962FF'
            : '#D1D4DC',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'background 0.12s ease, color 0.12s ease, transform 0.1s ease',
        transform: hovered && !disabled ? 'scale(1.08)' : 'scale(1)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
