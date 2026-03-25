// ═══════════════════════════════════════════════════════════════════
// charEdge — Macro Section (Intel Tab)
//
// Two-column layout for macro intelligence:
//   - Left:  Economic Calendar
//   - Right: Prediction Markets
// Responsive: stacks to single column on mobile (<768px).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import EconomicCalendarPro from '../discover/EconomicCalendarPro.jsx';
import PredictionMarkets from './PredictionMarkets.jsx';

// ─── Simple Mobile Detection Hook ───────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function MacroSection() {
  const isMobile = useIsMobile();

  return (
    <div>
      {/* ─── Section Header ────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.t1,
            fontFamily: F,
          }}
        >
          Macro & Predictions
        </span>
      </div>

      {/* ─── Two-Column Layout ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* Left Column — Economic Calendar */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
          <EconomicCalendarPro />
        </div>

        {/* Right Column — Prediction Markets */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
          <PredictionMarkets />
        </div>
      </div>
    </div>
  );
}

export default React.memo(MacroSection);
