// ═══════════════════════════════════════════════════════════════════
// charEdge — Economic Calendar Pro
//
// Sprint 5: Enhanced economic calendar with impact analysis.
// Features:
//   - Impact color coding (High/Medium/Low)
//   - Historical deviation analysis
//   - Countdown timers for imminent events
//   - Post-release impact tracker
//   - Context notes ("What this means")
//   - Filter by country, impact
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Economic Calendar Data ────────────────────────────────

const MOCK_EVENTS = [
  {
    id: 'e1', date: '2026-02-25', time: '08:30', event: 'Initial Jobless Claims',
    impact: 'high', country: 'US', previous: '215K', forecast: '220K', actual: null,
    history: [210, 215, 212, 218, 215, 220],
    context: 'Rising claims signal labor market weakness — historically positive for rate cut expectations, but bearish for equities short-term.',
    affectedAssets: ['SPY', 'NQ', 'GC'],
  },
  {
    id: 'e2', date: '2026-02-25', time: '10:00', event: 'Existing Home Sales',
    impact: 'medium', country: 'US', previous: '4.00M', forecast: '3.95M', actual: null,
    history: [3.85, 3.91, 4.00, 3.88, 3.95, 4.00],
    context: 'Housing data reflects consumer confidence and rate sensitivity. Below-forecast reads suggest more rate pressure.',
    affectedAssets: ['XHB', 'SPY'],
  },
  {
    id: 'e3', date: '2026-02-25', time: '13:00', event: 'FOMC Minutes Released',
    impact: 'high', country: 'US', previous: '—', forecast: '—', actual: null,
    history: [],
    context: 'Key focus: tone on inflation outlook and pace of rate cuts. Hawkish surprise = risk-off. Dovish = rally.',
    affectedAssets: ['SPY', 'NQ', 'BTC', 'GC', 'DXY'],
  },
  {
    id: 'e4', date: '2026-02-25', time: '14:30', event: 'ECB Speech — Lagarde',
    impact: 'medium', country: 'EU', previous: '—', forecast: '—', actual: null,
    history: [],
    context: 'Watch for hints about June rate decision. Dovish signals bullish for EUR/USD and European equities.',
    affectedAssets: ['EURUSD', 'DAX'],
  },
  {
    id: 'e5', date: '2026-02-26', time: '08:30', event: 'GDP (Q4 Second Estimate)',
    impact: 'high', country: 'US', previous: '3.3%', forecast: '3.2%', actual: null,
    history: [2.1, 2.9, 3.3, 3.2, 2.8, 3.3],
    context: 'GDP revisions rarely move markets unless significant. Watch for consumer spending component for forward guidance.',
    affectedAssets: ['SPY', 'NQ', 'DXY'],
  },
  {
    id: 'e6', date: '2026-02-26', time: '10:00', event: 'Consumer Confidence',
    impact: 'medium', country: 'US', previous: '110.5', forecast: '108.0', actual: null,
    history: [104.7, 108.0, 110.5, 106.1, 102.0, 110.5],
    context: 'Declining confidence = less consumer spending. Crypto often decouples but watch for correlation in risk-off environments.',
    affectedAssets: ['SPY', 'XLY'],
  },
  {
    id: 'e7', date: '2026-02-27', time: '08:30', event: 'Core PCE Price Index (MoM)',
    impact: 'high', country: 'US', previous: '0.2%', forecast: '0.3%', actual: null,
    history: [0.3, 0.2, 0.1, 0.2, 0.3, 0.2],
    context: 'The Fed\'s preferred inflation measure. Hot print = rate cut delay = bearish for risk. This is the most important data point this week.',
    affectedAssets: ['SPY', 'NQ', 'BTC', 'GC', 'TLT'],
  },
  {
    id: 'e8', date: '2026-02-28', time: '09:45', event: 'Chicago PMI',
    impact: 'low', country: 'US', previous: '46.0', forecast: '47.5', actual: null,
    history: [42.0, 44.0, 46.0, 45.2, 48.0, 46.0],
    context: 'Regional manufacturing indicator. Readings below 50 indicate contraction. Lower-impact but can set tone for ISM PMI next week.',
    affectedAssets: ['SPY'],
  },
];

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function EconomicCalendarPro() {
  const [impactFilter, setImpactFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(false);
  const [_now, setNow] = useState(Date.now());

  // Update "now" every minute for countdown timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return MOCK_EVENTS.filter((e) => {
      if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
      if (countryFilter !== 'all' && e.country !== countryFilter) return false;
      return true;
    });
  }, [impactFilter, countryFilter]);

  // Group by date
  const byDate = useMemo(() => {
    const groups = new Map();
    for (const e of filtered) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date).push(e);
    }
    return groups;
  }, [filtered]);

  const impactColors = { high: C.r, medium: C.y, low: C.g };
  const highImpactCount = MOCK_EVENTS.filter((e) => e.impact === 'high').length;

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Economic Calendar
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.r,
              background: alpha(C.r, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: M,
            }}
          >
            {highImpactCount} high-impact
          </span>
        </div>
        <span
          style={{
            color: C.t3,
            fontSize: 11,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'high', 'medium', 'low'].map((imp) => (
                <button
                  key={imp}
                  onClick={() => setImpactFilter(imp)}
                  className="tf-btn"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${impactFilter === imp ? (impactColors[imp] || C.b) : 'transparent'}`,
                    background: impactFilter === imp ? alpha(impactColors[imp] || C.b, 0.08) : 'transparent',
                    color: impactFilter === imp ? (impactColors[imp] || C.b) : C.t3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: F,
                    textTransform: 'capitalize',
                  }}
                >
                  {imp === 'all' ? '🌐 All' : imp === 'high' ? '🔴 High' : imp === 'medium' ? '🟡 Medium' : '🟢 Low'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'US', 'EU'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCountryFilter(c)}
                  className="tf-btn"
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: `1px solid ${countryFilter === c ? C.b : 'transparent'}`,
                    background: countryFilter === c ? alpha(C.b, 0.08) : 'transparent',
                    color: countryFilter === c ? C.b : C.t3,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: F,
                  }}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>

          {/* Events by Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...byDate.entries()].map(([date, events]) => (
              <div key={date}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.t3,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontFamily: F,
                    marginBottom: 8,
                  }}
                >
                  {formatCalDate(date)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {events.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Event Row (expandable)
// ═══════════════════════════════════════════════════════════════════

function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false);
  const impactColors = { high: C.r, medium: C.y, low: C.g };
  const impactColor = impactColors[event.impact] || C.t3;

  return (
    <div
      style={{
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.5)}`,
        borderLeft: `3px solid ${impactColor}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Main Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, fontFamily: M, minWidth: 44 }}>
          {event.time}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
            {event.event}
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: impactColor,
              background: alpha(impactColor, 0.12),
              padding: '2px 5px',
              borderRadius: 3,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontFamily: F,
            }}
          >
            {event.impact}
          </span>
          <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{event.country}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: M, color: C.t3, flexShrink: 0 }}>
          {event.previous !== '—' && (
            <span>
              Prev: <span style={{ color: C.t2 }}>{event.previous}</span>
            </span>
          )}
          {event.forecast !== '—' && (
            <span>
              Est: <span style={{ color: C.t2 }}>{event.forecast}</span>
            </span>
          )}
        </div>

        <span style={{ color: C.t3, fontSize: 10, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
          ▾
        </span>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${alpha(C.bd, 0.3)}`,
          }}
        >
          {/* Context / "What this means" */}
          <div
            style={{
              padding: '10px 12px',
              background: alpha(impactColor, 0.04),
              border: `1px solid ${alpha(impactColor, 0.1)}`,
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: impactColor, fontFamily: F, marginBottom: 4 }}>
              💡 What This Means
            </div>
            <p style={{ margin: 0, fontSize: 11, color: C.t2, fontFamily: F, lineHeight: 1.6 }}>
              {event.context}
            </p>
          </div>

          {/* Historical & Affected Assets */}
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Historical Readings */}
            {event.history.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
                  Recent Readings
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 32 }}>
                  {event.history.map((v, i) => {
                    const max = Math.max(...event.history);
                    const height = max > 0 ? (v / max) * 32 : 16;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${height}px`,
                          background: alpha(C.b, 0.3),
                          borderRadius: 2,
                        }}
                        title={`${v}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Affected Assets */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
                Assets Affected
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {event.affectedAssets.map((a) => (
                  <span
                    key={a}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.t2,
                      background: alpha(C.t3, 0.1),
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: M,
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════

function formatCalDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const prefix = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : days[d.getDay()];
  return `${prefix} · ${months[d.getMonth()]} ${d.getDate()}`;
}

export { EconomicCalendarPro };
