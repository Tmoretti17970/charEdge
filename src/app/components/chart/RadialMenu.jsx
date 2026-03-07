// ═══════════════════════════════════════════════════════════════════
// charEdge — Radial Context Menu (Sprint 10)
// 6-segment radial menu with CSS-animated open on right-click.
// Segments: Draw, Trade, Alert, Indicator, Measure, Screenshot
// v2: Each segment fans out a favorites submenu on click.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import './RadialMenu.module.css';

// ─── Main segment definitions ──────────────────────────────────
const SEGMENTS = [
  {
    id: 'draw',
    label: 'Draw',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M13.5 2l2.5 2.5-10 10H3.5v-2.5l10-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    color: '#22d3ee',
  },
  {
    id: 'trade',
    label: 'Trade',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 14l4-4 3 2 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <polyline points="11,5 14,5 14,8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    color: C.g,
  },
  {
    id: 'alert',
    label: 'Alert',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2c-3 0-5 2.5-5 5.5 0 3-1.5 4.5-1.5 4.5h13S14 10.5 14 7.5C14 4.5 12 2 9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M7.5 14s.5 2 1.5 2 1.5-2 1.5-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </svg>
    ),
    color: '#f0b64e',
  },
  {
    id: 'indicator',
    label: 'Indicator',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polyline points="2,12 5,6 8,10 11,4 15,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="11" cy="4" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
    ),
    color: '#a855f7',
  },
  {
    id: 'measure',
    label: 'Measure',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="3" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15" y1="3" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5" />
      </svg>
    ),
    color: '#f472b6',
  },
  {
    id: 'screenshot',
    label: 'Snapshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <circle cx="9" cy="9.5" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="9" cy="9.5" r="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    color: '#e8642c',
  },
];

// ─── Submenu favorites per segment ─────────────────────────────
const SUBMENU_ITEMS = {
  draw: [
    { id: 'trendline', label: 'Trend', icon: '📐' },
    { id: 'hline', label: 'H-Line', icon: '➖' },
    { id: 'fib', label: 'Fib', icon: '🌀' },
    { id: 'channel', label: 'Channel', icon: '═' },
    { id: 'rect', label: 'Rect', icon: '⬜' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
  trade: [
    { id: 'long', label: 'Long', icon: '📈' },
    { id: 'short', label: 'Short', icon: '📉' },
    { id: 'close', label: 'Close', icon: '✕' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
  alert: [
    { id: 'price', label: 'Price', icon: '🔔' },
    { id: 'above', label: 'Above', icon: '⬆' },
    { id: 'below', label: 'Below', icon: '⬇' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
  indicator: [
    { id: 'rsi', label: 'RSI', icon: '📊' },
    { id: 'ema', label: 'EMA', icon: '〰' },
    { id: 'macd', label: 'MACD', icon: '📉' },
    { id: 'bollinger', label: 'BB', icon: '🎯' },
    { id: 'vwap', label: 'VWAP', icon: '⚖' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
  measure: [
    { id: 'measure', label: 'Range', icon: '📏' },
    { id: 'barcount', label: 'Bars', icon: '#' },
    { id: 'pctchange', label: '%Δ', icon: '%' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
  screenshot: [
    { id: 'clipboard', label: 'Copy', icon: '📋' },
    { id: 'png', label: 'PNG', icon: '🖼' },
    { id: 'share', label: 'Share', icon: '↗' },
    { id: 'more', label: 'More…', icon: '•••' },
  ],
};

const RADIUS = 90;
const SEGMENT_SIZE = 48;
const SUB_RADIUS = 62;
const SUB_SIZE = 36;

export default function RadialMenu({ x, y, price, onAction, onClose }) {
  const ref = useRef(null);
  const [activeSegment, setActiveSegment] = useState(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    // Use timeout so the opening right-click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Escape: close submenu first, then full menu
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (activeSegment) {
          setActiveSegment(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, activeSegment]);

  // Handle main segment click — open submenu
  const handleSegment = useCallback((segId) => {
    setActiveSegment(segId);
  }, []);

  // Handle submenu item click — dispatch action & close
  const handleSubItem = useCallback((segId, subId) => {
    onAction(segId, subId, price);
    onClose();
  }, [onAction, price, onClose]);

  // Clamp position to viewport
  const menuSize = RADIUS * 2 + SEGMENT_SIZE;
  const cx = Math.max(menuSize / 2 + 8, Math.min(x, window.innerWidth - menuSize / 2 - 8));
  const cy = Math.max(menuSize / 2 + 8, Math.min(y, window.innerHeight - menuSize / 2 - 8));

  // Find active segment data for submenu positioning
  const activeSegIdx = activeSegment ? SEGMENTS.findIndex(s => s.id === activeSegment) : -1;
  const activeSegData = activeSegIdx >= 0 ? SEGMENTS[activeSegIdx] : null;
  const activeAngle = activeSegIdx >= 0 ? (activeSegIdx * 60 - 90) * (Math.PI / 180) : 0;
  const activeX = activeSegData ? Math.cos(activeAngle) * RADIUS : 0;
  const activeY = activeSegData ? Math.sin(activeAngle) * RADIUS : 0;
  const subItems = activeSegment ? (SUBMENU_ITEMS[activeSegment] || []) : [];

  return (
    <div
      ref={ref}
      className="tf-radial-menu"
      style={{
        position: 'fixed',
        left: cx,
        top: cy,
        zIndex: 300,
        pointerEvents: 'auto',
      }}
    >
      {/* Center hub */}
      <div
        style={{
          position: 'absolute',
          left: -20,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(14, 16, 22, 0.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          animation: 'radialPulse 0.3s ease forwards',
          // Dim when submenu is open
          opacity: activeSegment ? 0.3 : 1,
          transition: 'opacity 0.25s ease',
        }}
      >
        <span style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600 }}>
          {price?.toFixed(2) ?? '•'}
        </span>
      </div>

      {/* Main segments */}
      {SEGMENTS.map((seg, i) => {
        const angle = (i * 60 - 90) * (Math.PI / 180);
        const sx = Math.cos(angle) * RADIUS;
        const sy = Math.sin(angle) * RADIUS;
        const isActive = activeSegment === seg.id;
        const isDimmed = activeSegment && !isActive;

        return (
          <button
            key={seg.id}
            className="tf-radial-segment"
            onClick={() => handleSegment(seg.id)}
            title={seg.label}
            style={{
              position: 'absolute',
              left: sx - SEGMENT_SIZE / 2,
              top: sy - SEGMENT_SIZE / 2,
              width: SEGMENT_SIZE,
              height: SEGMENT_SIZE,
              borderRadius: '50%',
              background: isActive
                ? `rgba(14, 16, 22, 0.95)`
                : 'rgba(14, 16, 22, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${isActive ? seg.color : C.bd}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              color: isActive ? seg.color : C.t2,
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: `radialSegIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s both`,
              boxShadow: isActive
                ? `0 0 20px ${seg.color}30, 0 4px 16px rgba(0,0,0,0.4)`
                : '0 4px 16px rgba(0,0,0,0.3)',
              zIndex: isActive ? 10 : 1,
              padding: 0,
              opacity: isDimmed ? 0.25 : 1,
              transform: isActive ? 'scale(1.12)' : 'scale(1)',
              pointerEvents: isDimmed ? 'none' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (!isDimmed) {
                e.currentTarget.style.transform = isActive ? 'scale(1.12)' : 'scale(1.18)';
                e.currentTarget.style.borderColor = seg.color;
                e.currentTarget.style.color = seg.color;
                e.currentTarget.style.boxShadow = `0 0 20px ${seg.color}25, 0 4px 16px rgba(0,0,0,0.4)`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDimmed) {
                e.currentTarget.style.transform = isActive ? 'scale(1.12)' : 'scale(1)';
                e.currentTarget.style.borderColor = isActive ? seg.color : C.bd;
                e.currentTarget.style.color = isActive ? seg.color : C.t2;
                e.currentTarget.style.boxShadow = isActive
                  ? `0 0 20px ${seg.color}30, 0 4px 16px rgba(0,0,0,0.4)`
                  : '0 4px 16px rgba(0,0,0,0.3)';
              }
            }}
          >
            <span style={{ lineHeight: 1 }}>{seg.icon}</span>
            <span style={{ fontSize: 7, fontWeight: 700, fontFamily: F, letterSpacing: '0.3px', lineHeight: 1 }}>
              {seg.label}
            </span>
          </button>
        );
      })}

      {/* ─── Submenu fan-out ─────────────────────────────────── */}
      {activeSegment && subItems.map((item, i) => {
        const count = subItems.length;
        // Fan the sub-items in an arc centered on the active segment's direction
        const baseAngleDeg = activeSegIdx * 60 - 90;
        const spreadDeg = Math.min(45, 180 / Math.max(count, 1));
        const startDeg = baseAngleDeg - ((count - 1) * spreadDeg) / 2;
        const itemAngleDeg = startDeg + i * spreadDeg;
        const itemAngle = itemAngleDeg * (Math.PI / 180);

        const ix = activeX + Math.cos(itemAngle) * SUB_RADIUS;
        const iy = activeY + Math.sin(itemAngle) * SUB_RADIUS;

        const isMore = item.id === 'more';

        return (
          <button
            key={`${activeSegment}-${item.id}`}
            className="tf-radial-sub-item"
            onClick={() => handleSubItem(activeSegment, item.id)}
            title={item.label}
            style={{
              position: 'absolute',
              left: ix - SUB_SIZE / 2,
              top: iy - SUB_SIZE / 2,
              width: SUB_SIZE,
              height: SUB_SIZE,
              borderRadius: '50%',
              background: isMore
                ? 'rgba(14, 16, 22, 0.7)'
                : 'rgba(14, 16, 22, 0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${isMore ? C.bd : activeSegData.color + '60'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
              color: C.t2,
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: `radialSubIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.035}s both`,
              boxShadow: `0 2px 12px rgba(0,0,0,0.35)`,
              zIndex: 5,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.2)';
              e.currentTarget.style.borderColor = activeSegData.color;
              e.currentTarget.style.color = activeSegData.color;
              e.currentTarget.style.boxShadow = `0 0 16px ${activeSegData.color}30, 0 2px 12px rgba(0,0,0,0.4)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = isMore ? C.bd : activeSegData.color + '60';
              e.currentTarget.style.color = C.t2;
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.35)';
            }}
          >
            <span style={{ fontSize: 11, lineHeight: 1 }}>{item.icon}</span>
            <span style={{
              fontSize: 6,
              fontWeight: 700,
              fontFamily: F,
              letterSpacing: '0.2px',
              lineHeight: 1,
              opacity: 0.85,
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Connector lines (decorative) */}
      <svg
        style={{
          position: 'absolute',
          left: -RADIUS - SEGMENT_SIZE,
          top: -RADIUS - SEGMENT_SIZE,
          width: (RADIUS + SEGMENT_SIZE) * 2,
          height: (RADIUS + SEGMENT_SIZE) * 2,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {SEGMENTS.map((seg, i) => {
          const angle = (i * 60 - 90) * (Math.PI / 180);
          const ex = Math.cos(angle) * RADIUS + RADIUS + SEGMENT_SIZE;
          const ey = Math.sin(angle) * RADIUS + RADIUS + SEGMENT_SIZE;
          const cx2 = RADIUS + SEGMENT_SIZE;
          const cy2 = RADIUS + SEGMENT_SIZE;
          const isDimmed = activeSegment && activeSegment !== seg.id;
          return (
            <line
              key={seg.id}
              x1={cx2}
              y1={cy2}
              x2={ex}
              y2={ey}
              stroke={C.bd}
              strokeWidth="0.5"
              opacity={isDimmed ? 0.08 : 0.3}
              style={{
                animation: `radialLineIn 0.4s ease ${i * 0.04}s both`,
                transition: 'opacity 0.25s ease',
              }}
            />
          );
        })}

        {/* Submenu connector lines */}
        {activeSegment && subItems.map((item, i) => {
          const count = subItems.length;
          const baseAngleDeg = activeSegIdx * 60 - 90;
          const spreadDeg = Math.min(45, 180 / Math.max(count, 1));
          const startDeg = baseAngleDeg - ((count - 1) * spreadDeg) / 2;
          const itemAngleDeg = startDeg + i * spreadDeg;
          const itemAngle = itemAngleDeg * (Math.PI / 180);

          const fromX = activeX + RADIUS + SEGMENT_SIZE;
          const fromY = activeY + RADIUS + SEGMENT_SIZE;
          const toX = activeX + Math.cos(itemAngle) * SUB_RADIUS + RADIUS + SEGMENT_SIZE;
          const toY = activeY + Math.sin(itemAngle) * SUB_RADIUS + RADIUS + SEGMENT_SIZE;

          return (
            <line
              key={`sub-line-${item.id}`}
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke={activeSegData.color}
              strokeWidth="0.5"
              opacity="0.2"
              style={{ animation: `radialLineIn 0.3s ease ${i * 0.03}s both` }}
            />
          );
        })}
      </svg>

    </div>
  );
}
