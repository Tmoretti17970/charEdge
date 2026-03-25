// ═══════════════════════════════════════════════════════════════════
// charEdge — Options Flow Compact
//
// Compact options flow widget for the Intel Signals section.
// Shows top 5 unusual options trades with sweep badges.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { cboeAdapter } from '../../../data/adapters/CBOEAdapter.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data ──────────────────────────────────────────────────
const MOCK_FLOWS = [
  {
    id: 1,
    time: '14:32',
    symbol: 'NVDA',
    strike: '900C',
    expiry: '03/07',
    premium: 2850000,
    side: 'Buy',
    sweep: true,
    type: 'Call',
  },
  {
    id: 2,
    time: '14:30',
    symbol: 'SPY',
    strike: '505P',
    expiry: '02/28',
    premium: 1240000,
    side: 'Sell',
    sweep: false,
    type: 'Put',
  },
  {
    id: 3,
    time: '14:28',
    symbol: 'AAPL',
    strike: '200C',
    expiry: '03/21',
    premium: 890000,
    side: 'Buy',
    sweep: false,
    type: 'Call',
  },
  {
    id: 4,
    time: '14:25',
    symbol: 'TSLA',
    strike: '260C',
    expiry: '03/07',
    premium: 4200000,
    side: 'Buy',
    sweep: true,
    type: 'Call',
  },
  {
    id: 5,
    time: '14:22',
    symbol: 'META',
    strike: '500P',
    expiry: '03/14',
    premium: 1600000,
    side: 'Buy',
    sweep: false,
    type: 'Put',
  },
];

// ─── Helpers ────────────────────────────────────────────────────
function fmtPremium(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

// ─── VIX / P-C Summary Bar ──────────────────────────────────────
function MarketSummaryBar({ vix, pcRatio, termStructure }) {
  // Determine contango vs backwardation from term structure
  let termLabel = '—';
  if (termStructure && termStructure.length >= 2) {
    const first = termStructure[0]?.price;
    const last = termStructure[termStructure.length - 1]?.price;
    if (first != null && last != null) {
      termLabel = last > first ? 'Contango' : 'Backwardation';
    }
  }

  const vixValue = vix?.value != null ? vix.value.toFixed(1) : '—';
  const pcValue = pcRatio != null ? pcRatio.toFixed(2) : '—';
  const vixColor = vix?.value != null && vix.value > 20 ? C.r : vix?.value != null && vix.value > 15 ? '#f0b64e' : C.g;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 10px',
        marginBottom: 4,
        borderRadius: 8,
        background: alpha(C.sf, 0.6),
        border: `1px solid ${alpha(C.bd, 0.4)}`,
        fontFamily: F,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span style={{ color: C.t3 }}>VIX:</span>
      <span style={{ color: vixColor }}>{vixValue}</span>
      <span style={{ color: alpha(C.bd, 0.6) }}>|</span>
      <span style={{ color: C.t3 }}>P/C:</span>
      <span style={{ color: C.t1 }}>{pcValue}</span>
      <span style={{ color: alpha(C.bd, 0.6) }}>|</span>
      <span style={{ color: C.t3 }}>Term:</span>
      <span style={{ color: termLabel === 'Contango' ? C.g : termLabel === 'Backwardation' ? C.r : C.t2 }}>
        {termLabel}
      </span>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────
function OptionsFlowCompact() {
  const [vixData, setVixData] = useState(null);
  const [pcRatio, setPcRatio] = useState(null);
  const [termStructure, setTermStructure] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCBOEData() {
      try {
        const [vix, pcData, term] = await Promise.all([
          cboeAdapter.fetchVIX(),
          cboeAdapter.fetchPutCallRatio(5),
          cboeAdapter.fetchVIXTermStructure(),
        ]);
        if (cancelled) return;
        setVixData(vix);
        // Use most recent P/C ratio
        if (Array.isArray(pcData) && pcData.length > 0) {
          setPcRatio(pcData[0].pcRatio);
        }
        setTermStructure(term);
      } catch (_err) {
        // eslint-disable-next-line no-console
        console.warn('[OptionsFlowCompact] CBOE data fetch failed', _err);
      }
    }

    loadCBOEData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* VIX / P-C Ratio / Term Structure summary */}
      <MarketSummaryBar vix={vixData} pcRatio={pcRatio} termStructure={termStructure} />

      {/* Individual flow rows (mock data — no free individual flow API) */}
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MOCK_FLOWS.map((f) => {
          const isCall = f.type === 'Call';
          const tint = isCall ? C.g : C.r;

          return (
            <div
              key={f.id}
              role="listitem"
              aria-label={`${f.time} ${f.symbol} ${f.strike} ${f.side} ${fmtPremium(f.premium)} ${f.type}${f.sweep ? ' Sweep' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                background: alpha(tint, 0.04),
                borderLeft: `2px solid ${alpha(tint, 0.4)}`,
                fontFamily: F,
                fontSize: 12,
                color: C.t1,
                transition: 'background 0.15s ease',
              }}
            >
              {/* Time */}
              <span style={{ color: C.t3, fontSize: 11, minWidth: 36, flexShrink: 0 }}>{f.time}</span>

              {/* Symbol + Strike */}
              <span style={{ fontWeight: 700, minWidth: 68, color: tint, flexShrink: 0 }}>
                {f.symbol} {f.strike}
              </span>

              {/* Expiry */}
              <span style={{ color: C.t3, fontSize: 11, minWidth: 38, flexShrink: 0 }}>{f.expiry}</span>

              {/* Side */}
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 11,
                  minWidth: 28,
                  color: f.side === 'Buy' ? C.g : C.r,
                  flexShrink: 0,
                }}
              >
                {f.side}
              </span>

              {/* Premium */}
              <span style={{ fontWeight: 600, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                {fmtPremium(f.premium)}
              </span>

              {/* Sweep badge */}
              {f.sweep && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: alpha(C.b, 0.15),
                    color: C.b,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    lineHeight: '16px',
                    flexShrink: 0,
                  }}
                >
                  SWEEP
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer link */}
      <div style={{ textAlign: 'right', paddingTop: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: F,
            fontWeight: 600,
            color: C.b,
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          View all flow &rarr;
        </span>
      </div>
    </div>
  );
}

export default React.memo(OptionsFlowCompact);
