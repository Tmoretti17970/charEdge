// ═══════════════════════════════════════════════════════════════════
// charEdge — Radial Context Menu (v4 Trader-First)
// Redesigned with a TradingView × Apple philosophy.
// 5 segments: Trade, Alert, Journal, Draw, Indicator
// Center hub: shows price + one-click copy to clipboard.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, F, GLASS, DEPTH } from '../../../constants.js';

// ─── Segment definitions (5 segments × 72° each) ──────────────
const SEGMENTS = [
  {
    id: 'trade',
    label: 'Trade',
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 14l4-4 3 2 5-7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="11,5 14,5 14,8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    color: 'var(--tf-green, #2dd4a0)',
    hint: 'T',
  },
  {
    id: 'alert',
    label: 'Alert',
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 2c-3 0-5 2.5-5 5.5 0 3-1.5 4.5-1.5 4.5h13S14 10.5 14 7.5C14 4.5 12 2 9 2z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7.5 14s.5 2 1.5 2 1.5-2 1.5-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    color: 'var(--tf-yellow, #f0b64e)',
    hint: 'A',
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </svg>
    ),
    color: 'var(--tf-cyan, #22d3ee)',
    hint: 'J',
  },
  {
    id: 'draw',
    label: 'Draw',
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <path
          d="M13.5 2l2.5 2.5-10 10H3.5v-2.5l10-10z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    color: 'var(--tf-purple, #a855f7)',
    hint: 'D',
  },
  {
    id: 'indicator',
    label: 'Indicator',
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
        <polyline
          points="2,12 5,6 8,10 11,4 15,8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="11" cy="4" r="1.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
    color: 'var(--tf-pink, #f472b6)',
    hint: 'I',
  },
];

// ─── Submenu items per segment ─────────────────────────────────
const SUBMENU_ITEMS = {
  trade: [
    { id: 'long', label: 'Buy', icon: '📈' },
    { id: 'short', label: 'Sell', icon: '📉' },
    { id: 'close', label: 'Close', icon: '✕' },
  ],
  alert: [
    { id: 'price', label: 'Price', icon: '🔔' },
    { id: 'above', label: 'Above', icon: '⬆' },
    { id: 'below', label: 'Below', icon: '⬇' },
  ],
  journal: [
    { id: 'quickNote', label: 'Note', icon: '📝' },
    { id: 'tagLevel', label: 'Tag', icon: '🏷' },
    { id: 'screenshotNote', label: 'Snap', icon: '📸' },
  ],
  draw: [
    { id: 'trendline', label: 'Trend', icon: '📐' },
    { id: 'hline', label: 'H-Line', icon: '➖' },
    { id: 'fib', label: 'Fib', icon: '🌀' },
    { id: 'channel', label: 'Chan', icon: '═' },
    { id: 'rect', label: 'Rect', icon: '⬜' },
  ],
  indicator: [
    { id: 'rsi', label: 'RSI', icon: '📊' },
    { id: 'ema', label: 'EMA', icon: '〰' },
    { id: 'macd', label: 'MACD', icon: '📉' },
    { id: 'bollinger', label: 'BB', icon: '🎯' },
    { id: 'vwap', label: 'VWAP', icon: '⚖' },
  ],
};

// ─── Sizing (slightly larger for better UX) ────────────────────
const RADIUS = 62;
const SEG_SIZE = 42;
const SUB_RADIUS = 52;
const SUB_SIZE = 34;
const CENTER_SIZE = 40;
const ANGLE_STEP = 72; // 360 / 5 segments

export default function RadialMenu({ x, y, price, onAction, onClose }) {
  const ref = useRef(null);
  const [activeSegment, setActiveSegment] = useState(null);
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (activeSegment) setActiveSegment(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, activeSegment]);

  // Segment click toggles submenu
  const handleSegment = useCallback(
    (segId) => {
      if (activeSegment === segId) {
        setActiveSegment(null);
      } else {
        setActiveSegment(segId);
      }
    },
    [activeSegment],
  );

  // Submenu item click
  const handleSubItem = useCallback(
    (segId, subId) => {
      onAction(segId, subId, price);
      onClose();
    },
    [onAction, price, onClose],
  );

  // Center hub: copy price to clipboard
  const handleCopyPrice = useCallback(() => {
    if (price != null) {
      const priceStr = price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      navigator.clipboard
        .writeText(priceStr)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        })
        .catch(() => {
          // Fallback: still fire the action
          onAction('center', 'copyPrice', price);
        });
    }
  }, [price, onAction]);

  // Clamp to viewport
  const pad = RADIUS + SEG_SIZE + 16;
  const cx = Math.max(pad, Math.min(x, window.innerWidth - pad));
  const cy = Math.max(pad, Math.min(y, window.innerHeight - pad));

  const activeSegIdx = activeSegment ? SEGMENTS.findIndex((s) => s.id === activeSegment) : -1;
  const activeSegData = activeSegIdx >= 0 ? SEGMENTS[activeSegIdx] : null;
  const activeAngle = activeSegIdx >= 0 ? (activeSegIdx * ANGLE_STEP - 90) * (Math.PI / 180) : 0;
  const activeX = activeSegData ? Math.cos(activeAngle) * RADIUS : 0;
  const activeY = activeSegData ? Math.sin(activeAngle) * RADIUS : 0;
  const subItems = activeSegment ? SUBMENU_ITEMS[activeSegment] || [] : [];

  // Glass / theme tokens
  const glassBg = GLASS.standard;
  const glassBlur = 'blur(16px) saturate(1.5)';
  const borderColor = C.bd;
  const shadow = DEPTH[2];

  // Format price for center hub
  const formattedPrice =
    price != null
      ? price >= 1000
        ? price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : price.toFixed(2)
      : '•';

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
      {/* ─── Center Hub — Price + Copy ──────────────────────── */}
      <button
        onClick={handleCopyPrice}
        title="Click to copy price"
        style={{
          position: 'absolute',
          left: -CENTER_SIZE / 2,
          top: -CENTER_SIZE / 2,
          width: CENTER_SIZE,
          height: CENTER_SIZE,
          borderRadius: '50%',
          background: glassBg,
          backdropFilter: glassBlur,
          WebkitBackdropFilter: glassBlur,
          border: `1.5px solid ${copied ? 'var(--tf-green, #2dd4a0)' : borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          zIndex: 12,
          cursor: 'pointer',
          padding: 0,
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1)' : 'scale(0.5)',
          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: copied ? `0 0 16px rgba(45, 212, 160, 0.3), ${shadow}` : `0 0 12px rgba(0,0,0,0.3), ${shadow}`,
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.borderColor = 'var(--tf-accent, #e8642c)';
            e.currentTarget.style.transform = 'scale(1.08)';
          }
        }}
        onMouseLeave={(e) => {
          if (!copied) {
            e.currentTarget.style.borderColor = borderColor;
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.5l3.5 3.5 6.5-7"
              stroke="var(--tf-green, #2dd4a0)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: F,
                color: 'var(--tf-accent, #e8642c)',
                lineHeight: 1,
                letterSpacing: '-0.3px',
              }}
            >
              {formattedPrice}
            </span>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
              <rect x="1" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path
                d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H9"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          </>
        )}
      </button>

      {/* ─── Main Segments (5 × 72°) ────────────────────────── */}
      {SEGMENTS.map((seg, i) => {
        const angle = (i * ANGLE_STEP - 90) * (Math.PI / 180);
        const sx = Math.cos(angle) * RADIUS;
        const sy = Math.sin(angle) * RADIUS;
        const isActive = activeSegment === seg.id;
        const isDimmed = activeSegment && !isActive;

        return (
          <button
            key={seg.id}
            onClick={() => handleSegment(seg.id)}
            title={`${seg.label} (${seg.hint})`}
            style={{
              position: 'absolute',
              left: sx - SEG_SIZE / 2,
              top: sy - SEG_SIZE / 2,
              width: SEG_SIZE,
              height: SEG_SIZE,
              borderRadius: '50%',
              background: glassBg,
              backdropFilter: glassBlur,
              WebkitBackdropFilter: glassBlur,
              border: `1.5px solid ${isActive ? seg.color : borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              color: isActive ? seg.color : C.t2,
              transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: isActive ? `0 0 14px color-mix(in srgb, ${seg.color} 25%, transparent), ${shadow}` : shadow,
              zIndex: isActive ? 10 : 1,
              padding: 0,
              opacity: entered ? (isDimmed ? 0.15 : 1) : 0,
              transform: entered ? (isActive ? 'scale(1.1)' : 'scale(1)') : 'scale(0.3) rotate(-20deg)',
              transitionDelay: entered ? '0s' : `${i * 0.04}s`,
              pointerEvents: isDimmed ? 'none' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (!isDimmed) {
                e.currentTarget.style.transform = isActive ? 'scale(1.1)' : 'scale(1.14)';
                e.currentTarget.style.borderColor = seg.color;
                e.currentTarget.style.color = seg.color;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDimmed) {
                e.currentTarget.style.transform = isActive ? 'scale(1.1)' : 'scale(1)';
                e.currentTarget.style.borderColor = isActive ? seg.color : borderColor;
                e.currentTarget.style.color = isActive ? seg.color : C.t2;
              }
            }}
          >
            <span style={{ lineHeight: 1 }}>{seg.icon}</span>
            <span
              style={{
                fontSize: 7,
                fontWeight: 700,
                fontFamily: F,
                letterSpacing: '0.3px',
                lineHeight: 1,
              }}
            >
              {seg.label}
            </span>
            {/* Keyboard shortcut hint */}
            <span
              style={{
                fontSize: 6,
                fontWeight: 500,
                fontFamily: F,
                opacity: 0.35,
                lineHeight: 1,
                marginTop: -1,
              }}
            >
              {seg.hint}
            </span>
          </button>
        );
      })}

      {/* ─── Submenu fan-out ────────────────────────────────── */}
      {activeSegment &&
        subItems.map((item, i) => {
          const count = subItems.length;
          const baseAngleDeg = activeSegIdx * ANGLE_STEP - 90;
          const spreadDeg = Math.min(42, 170 / Math.max(count, 1));
          const startDeg = baseAngleDeg - ((count - 1) * spreadDeg) / 2;
          const itemAngleDeg = startDeg + i * spreadDeg;
          const itemAngle = itemAngleDeg * (Math.PI / 180);

          const ix = activeX + Math.cos(itemAngle) * SUB_RADIUS;
          const iy = activeY + Math.sin(itemAngle) * SUB_RADIUS;

          return (
            <button
              key={`${activeSegment}-${item.id}`}
              onClick={() => handleSubItem(activeSegment, item.id)}
              title={item.label}
              style={{
                position: 'absolute',
                left: ix - SUB_SIZE / 2,
                top: iy - SUB_SIZE / 2,
                width: SUB_SIZE,
                height: SUB_SIZE,
                borderRadius: '50%',
                background: glassBg,
                backdropFilter: glassBlur,
                WebkitBackdropFilter: glassBlur,
                border: `1px solid color-mix(in srgb, ${activeSegData.color} 40%, ${borderColor})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                cursor: 'pointer',
                color: C.t2,
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transitionDelay: `${i * 0.03}s`,
                boxShadow: shadow,
                zIndex: 5,
                padding: 0,
                opacity: 1,
                transform: 'scale(1)',
                animation: `rmSubIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.03}s both`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.borderColor = activeSegData.color;
                e.currentTarget.style.color = activeSegData.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = `color-mix(in srgb, ${activeSegData.color} 40%, ${borderColor})`;
                e.currentTarget.style.color = C.t2;
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>{item.icon}</span>
              <span
                style={{
                  fontSize: 6.5,
                  fontWeight: 700,
                  fontFamily: F,
                  letterSpacing: '0.2px',
                  lineHeight: 1,
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}

      {/* ─── Connector lines (decorative) ───────────────────── */}
      <svg
        style={{
          position: 'absolute',
          left: -(RADIUS + SEG_SIZE),
          top: -(RADIUS + SEG_SIZE),
          width: (RADIUS + SEG_SIZE) * 2,
          height: (RADIUS + SEG_SIZE) * 2,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {SEGMENTS.map((seg, i) => {
          const angle = (i * ANGLE_STEP - 90) * (Math.PI / 180);
          const ex = Math.cos(angle) * RADIUS + RADIUS + SEG_SIZE;
          const ey = Math.sin(angle) * RADIUS + RADIUS + SEG_SIZE;
          const c = RADIUS + SEG_SIZE;
          const isDimmed = activeSegment && activeSegment !== seg.id;
          return (
            <line
              key={seg.id}
              x1={c}
              y1={c}
              x2={ex}
              y2={ey}
              stroke={borderColor}
              strokeWidth="0.5"
              opacity={entered ? (isDimmed ? 0.04 : 0.2) : 0}
              style={{ transition: 'opacity 0.3s ease' }}
            />
          );
        })}

        {/* Submenu connector lines */}
        {activeSegment &&
          subItems.map((item, i) => {
            const count = subItems.length;
            const baseAngleDeg = activeSegIdx * ANGLE_STEP - 90;
            const spreadDeg = Math.min(42, 170 / Math.max(count, 1));
            const startDeg = baseAngleDeg - ((count - 1) * spreadDeg) / 2;
            const itemAngleDeg = startDeg + i * spreadDeg;
            const itemAngle = itemAngleDeg * (Math.PI / 180);

            const c = RADIUS + SEG_SIZE;
            const fromX = activeX + c;
            const fromY = activeY + c;
            const toX = activeX + Math.cos(itemAngle) * SUB_RADIUS + c;
            const toY = activeY + Math.sin(itemAngle) * SUB_RADIUS + c;

            return (
              <line
                key={`sub-line-${item.id}`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={activeSegData.color}
                strokeWidth="0.5"
                opacity="0.15"
                style={{ transition: 'opacity 0.2s ease' }}
              />
            );
          })}
      </svg>

      {/* Inline keyframes */}
      <style>
        {`
        @keyframes rmSubIn {
          from { opacity: 0; transform: scale(0.2) rotate(-15deg); }
          50% { opacity: 0.9; transform: scale(1.06) rotate(1deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}
      </style>
    </div>
  );
}
