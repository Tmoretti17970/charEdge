// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops View Mode Toggle
//
// Apple-style segmented control for switching between
// Table / Cards / Heatmap views in the Tops discovery tab.
//
// Manages local view state (independent from watchlist viewMode).
// ═══════════════════════════════════════════════════════════════════

import { memo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { C } from '../../../constants.js';

const VIEW_MODES = [
  {
    id: 'table',
    label: 'Table',
    icon: (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
  {
    id: 'cards',
    label: 'Cards',
    icon: (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    icon: (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="8" height="10" rx="1" />
        <rect x="13" y="3" width="8" height="6" rx="1" />
        <rect x="3" y="15" width="8" height="6" rx="1" />
        <rect x="13" y="11" width="8" height="10" rx="1" />
      </svg>
    ),
  },
];

export default memo(function TopsViewToggle({ viewMode, setViewMode }) {
  const containerRef = useRef(null);
  const optionRefs = useRef({});
  const [slider, setSlider] = useState({ left: 0, width: 0, ready: false });

  const updateSlider = useCallback(() => {
    const container = containerRef.current;
    const activeEl = optionRefs.current[viewMode];
    if (!container || !activeEl) return;
    const cRect = container.getBoundingClientRect();
    const aRect = activeEl.getBoundingClientRect();
    setSlider({ left: aRect.left - cRect.left, width: aRect.width, ready: true });
  }, [viewMode]);

  useLayoutEffect(() => {
    updateSlider();
  }, [updateSlider]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 10,
        padding: 3,
        gap: 2,
        background: C.sf2,
        border: `1px solid ${C.bd}`,
        height: 30,
        flexShrink: 0,
      }}
    >
      {/* Sliding background */}
      {slider.ready && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            height: 'calc(100% - 6px)',
            borderRadius: 7,
            left: slider.left,
            width: slider.width,
            background: 'var(--tf-sf)',
            boxShadow: 'var(--tf-shadow-1)',
            transition: 'left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            ref={(el) => {
              optionRefs.current[mode.id] = el;
            }}
            onClick={() => setViewMode(mode.id)}
            aria-label={`Switch to ${mode.label} view`}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              border: 'none',
              background: 'transparent',
              borderRadius: 7,
              cursor: 'pointer',
              color: isActive ? C.t1 : C.t3,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--tf-font, -apple-system, BlinkMacSystemFont, sans-serif)',
              transition: 'color 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {mode.icon}
            {mode.label}
          </button>
        );
      })}
    </div>
  );
});
