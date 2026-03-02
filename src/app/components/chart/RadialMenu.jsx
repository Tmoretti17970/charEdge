// ═══════════════════════════════════════════════════════════════════
// charEdge — Radial Context Menu (Sprint 10)
// 6-segment radial menu with CSS-animated open on right-click.
// Segments: Draw, Trade, Alert, Indicator, Measure, Screenshot
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback } from 'react';
import { C, F } from '../../../constants.js';

const SEGMENTS = [
  {
    id: 'draw',
    label: 'Draw',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M13.5 2l2.5 2.5-10 10H3.5v-2.5l10-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    color: '#22d3ee',
  },
  {
    id: 'trade',
    label: 'Trade',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 14l4-4 3 2 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <polyline points="11,5 14,5 14,8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    color: '#2dd4a0',
  },
  {
    id: 'alert',
    label: 'Alert',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2c-3 0-5 2.5-5 5.5 0 3-1.5 4.5-1.5 4.5h13S14 10.5 14 7.5C14 4.5 12 2 9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M7.5 14s.5 2 1.5 2 1.5-2 1.5-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    color: '#f0b64e',
  },
  {
    id: 'indicator',
    label: 'Indicator',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polyline points="2,12 5,6 8,10 11,4 15,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="11" cy="4" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
      </svg>
    ),
    color: '#a855f7',
  },
  {
    id: 'measure',
    label: 'Measure',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="3" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="15" y1="3" x2="15" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
      </svg>
    ),
    color: '#f472b6',
  },
  {
    id: 'screenshot',
    label: 'Snapshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
        <circle cx="9" cy="9.5" r="3" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <circle cx="9" cy="9.5" r="1" fill="currentColor" opacity="0.4"/>
      </svg>
    ),
    color: '#e8642c',
  },
];

const RADIUS = 90;
const SEGMENT_SIZE = 48;

export default function RadialMenu({ x, y, price, onAction, onClose }) {
  const ref = useRef(null);

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

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSegment = useCallback((segId) => {
    onAction(segId, price);
    onClose();
  }, [onAction, price, onClose]);

  // Clamp position to viewport
  const menuSize = RADIUS * 2 + SEGMENT_SIZE;
  const cx = Math.max(menuSize / 2 + 8, Math.min(x, window.innerWidth - menuSize / 2 - 8));
  const cy = Math.max(menuSize / 2 + 8, Math.min(y, window.innerHeight - menuSize / 2 - 8));

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
          animation: 'tfRadialPulse 0.3s ease forwards',
        }}
      >
        <span style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600 }}>
          {price?.toFixed(2) ?? '•'}
        </span>
      </div>

      {/* Segments */}
      {SEGMENTS.map((seg, i) => {
        const angle = (i * 60 - 90) * (Math.PI / 180); // Start at top
        const sx = Math.cos(angle) * RADIUS;
        const sy = Math.sin(angle) * RADIUS;

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
              background: 'rgba(14, 16, 22, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${C.bd}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              color: C.t2,
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: `tfRadialSegIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s both`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              zIndex: 1,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.18)';
              e.currentTarget.style.borderColor = seg.color;
              e.currentTarget.style.color = seg.color;
              e.currentTarget.style.boxShadow = `0 0 20px ${seg.color}25, 0 4px 16px rgba(0,0,0,0.4)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = C.bd;
              e.currentTarget.style.color = C.t2;
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
            }}
          >
            <span style={{ lineHeight: 1 }}>{seg.icon}</span>
            <span style={{ fontSize: 7, fontWeight: 700, fontFamily: F, letterSpacing: '0.3px', lineHeight: 1 }}>
              {seg.label}
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
          return (
            <line
              key={seg.id}
              x1={cx2}
              y1={cy2}
              x2={ex}
              y2={ey}
              stroke={C.bd}
              strokeWidth="0.5"
              opacity="0.3"
              style={{ animation: `tfRadialLineIn 0.4s ease ${i * 0.04}s both` }}
            />
          );
        })}
      </svg>

      {/* CSS Animations */}
      <style>{`
        @keyframes tfRadialSegIn {
          from { opacity: 0; transform: scale(0.3) rotate(-30deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes tfRadialPulse {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes tfRadialLineIn {
          from { opacity: 0; }
          to   { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
