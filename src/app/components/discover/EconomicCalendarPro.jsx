// ═══════════════════════════════════════════════════════════════════
// charEdge — Economic Calendar Pro
// ═══════════════════════════════════════════════════════════════════

import { Calendar, Globe, Circle, Lightbulb } from 'lucide-react';
import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { C } from '../../../constants.js';
import st from './EconomicCalendarPro.module.css';
import { alpha } from '@/shared/colorUtils';

const MOCK_EVENTS = [
  {
    id: 'e1',
    date: '2026-02-25',
    time: '08:30',
    event: 'Initial Jobless Claims',
    impact: 'high',
    country: 'US',
    previous: '215K',
    forecast: '220K',
    actual: null,
    history: [210, 215, 212, 218, 215, 220],
    context:
      'Rising claims signal labor market weakness — historically positive for rate cut expectations, but bearish for equities short-term.',
    affectedAssets: ['SPY', 'NQ', 'GC'],
  },
  {
    id: 'e2',
    date: '2026-02-25',
    time: '10:00',
    event: 'Existing Home Sales',
    impact: 'medium',
    country: 'US',
    previous: '4.00M',
    forecast: '3.95M',
    actual: null,
    history: [3.85, 3.91, 4.0, 3.88, 3.95, 4.0],
    context:
      'Housing data reflects consumer confidence and rate sensitivity. Below-forecast reads suggest more rate pressure.',
    affectedAssets: ['XHB', 'SPY'],
  },
  {
    id: 'e3',
    date: '2026-02-25',
    time: '13:00',
    event: 'FOMC Minutes Released',
    impact: 'high',
    country: 'US',
    previous: '—',
    forecast: '—',
    actual: null,
    history: [],
    context: 'Key focus: tone on inflation outlook and pace of rate cuts. Hawkish surprise = risk-off. Dovish = rally.',
    affectedAssets: ['SPY', 'NQ', 'BTC', 'GC', 'DXY'],
  },
  {
    id: 'e4',
    date: '2026-02-25',
    time: '14:30',
    event: 'ECB Speech — Lagarde',
    impact: 'medium',
    country: 'EU',
    previous: '—',
    forecast: '—',
    actual: null,
    history: [],
    context: 'Watch for hints about June rate decision. Dovish signals bullish for EUR/USD and European equities.',
    affectedAssets: ['EURUSD', 'DAX'],
  },
  {
    id: 'e5',
    date: '2026-02-26',
    time: '08:30',
    event: 'GDP (Q4 Second Estimate)',
    impact: 'high',
    country: 'US',
    previous: '3.3%',
    forecast: '3.2%',
    actual: null,
    history: [2.1, 2.9, 3.3, 3.2, 2.8, 3.3],
    context:
      'GDP revisions rarely move markets unless significant. Watch for consumer spending component for forward guidance.',
    affectedAssets: ['SPY', 'NQ', 'DXY'],
  },
  {
    id: 'e6',
    date: '2026-02-26',
    time: '10:00',
    event: 'Consumer Confidence',
    impact: 'medium',
    country: 'US',
    previous: '110.5',
    forecast: '108.0',
    actual: null,
    history: [104.7, 108.0, 110.5, 106.1, 102.0, 110.5],
    context:
      'Declining confidence = less consumer spending. Crypto often decouples but watch for correlation in risk-off environments.',
    affectedAssets: ['SPY', 'XLY'],
  },
  {
    id: 'e7',
    date: '2026-02-27',
    time: '08:30',
    event: 'Core PCE Price Index (MoM)',
    impact: 'high',
    country: 'US',
    previous: '0.2%',
    forecast: '0.3%',
    actual: null,
    history: [0.3, 0.2, 0.1, 0.2, 0.3, 0.2],
    context:
      "The Fed's preferred inflation measure. Hot print = rate cut delay = bearish for risk. This is the most important data point this week.",
    affectedAssets: ['SPY', 'NQ', 'BTC', 'GC', 'TLT'],
  },
  {
    id: 'e8',
    date: '2026-02-28',
    time: '09:45',
    event: 'Chicago PMI',
    impact: 'low',
    country: 'US',
    previous: '46.0',
    forecast: '47.5',
    actual: null,
    history: [42.0, 44.0, 46.0, 45.2, 48.0, 46.0],
    context:
      'Regional manufacturing indicator. Readings below 50 indicate contraction. Lower-impact but can set tone for ISM PMI next week.',
    affectedAssets: ['SPY'],
  },
];

function EconomicCalendarPro() {
  const [impactFilter, setImpactFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(false);
  const [_now, setNow] = useState(Date.now());

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
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${st.headerBtn}`}>
        <div className={st.headerLeft}>
          <Calendar size={18} color={C.t1} />
          <h3 className={st.headerTitle}>Economic Calendar</h3>
          <span className={st.badge} style={{ color: C.r, background: alpha(C.r, 0.1) }}>
            {highImpactCount} high-impact
          </span>
        </div>
        <span className={st.chevron} style={{ color: C.t3, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▾
        </span>
      </button>

      {!collapsed && (
        <div className={st.body}>
          <div className={st.filterRow}>
            <div className={st.filterGroup}>
              {['all', 'high', 'medium', 'low'].map((imp) => (
                <button
                  key={imp}
                  onClick={() => setImpactFilter(imp)}
                  className={`tf-btn ${st.filterBtn}`}
                  style={{
                    border: `1px solid ${impactFilter === imp ? impactColors[imp] || C.b : 'transparent'}`,
                    background: impactFilter === imp ? alpha(impactColors[imp] || C.b, 0.08) : 'transparent',
                    color: impactFilter === imp ? impactColors[imp] || C.b : C.t3,
                  }}
                >
                  {imp === 'all' ? (
                    <>
                      <Globe size={12} /> All
                    </>
                  ) : imp === 'high' ? (
                    <>
                      <Circle size={8} fill={C.r} stroke="none" /> High
                    </>
                  ) : imp === 'medium' ? (
                    <>
                      <Circle size={8} fill="#f0b64e" stroke="none" /> Medium
                    </>
                  ) : (
                    <>
                      <Circle size={8} fill={C.g} stroke="none" /> Low
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className={st.filterGroup}>
              {['all', 'US', 'EU'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCountryFilter(c)}
                  className={`tf-btn ${st.countryBtn}`}
                  style={{
                    border: `1px solid ${countryFilter === c ? C.b : 'transparent'}`,
                    background: countryFilter === c ? alpha(C.b, 0.08) : 'transparent',
                    color: countryFilter === c ? C.b : C.t3,
                  }}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>

          <div className={st.dateList}>
            {[...byDate.entries()].map(([date, events]) => (
              <div key={date}>
                <div className={st.dateHeader} style={{ color: C.t3 }}>
                  {formatCalDate(date)}
                </div>
                <div className={st.eventList}>
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

function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false);
  const impactColors = { high: C.r, medium: C.y, low: C.g };
  const impactColor = impactColors[event.impact] || C.t3;

  return (
    <div
      className={st.eventCard}
      onClick={() => setExpanded(!expanded)}
      style={{
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.5)}`,
        borderLeft: `3px solid ${impactColor}`,
      }}
    >
      <div className={st.eventMain}>
        <div className={st.eventTime} style={{ color: C.t2 }}>
          {event.time}
        </div>
        <div className={st.eventTitle}>
          <span className={st.eventName}>{event.event}</span>
          <span className={st.impactTag} style={{ color: impactColor, background: alpha(impactColor, 0.12) }}>
            {event.impact}
          </span>
          <span className={st.countryTag} style={{ color: C.t3 }}>
            {event.country}
          </span>
        </div>
        <div className={st.dataCol} style={{ color: C.t3 }}>
          {event.previous !== '—' && (
            <span>
              Prev: <span className={st.dataValue}>{event.previous}</span>
            </span>
          )}
          {event.forecast !== '—' && (
            <span>
              Est: <span className={st.dataValue}>{event.forecast}</span>
            </span>
          )}
        </div>
        <span
          className={st.rowChevron}
          style={{ color: C.t3, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </div>

      {expanded && (
        <div className={st.expandBody} style={{ borderTop: `1px solid ${alpha(C.bd, 0.3)}` }}>
          <div
            className={st.contextBox}
            style={{ background: alpha(impactColor, 0.04), border: `1px solid ${alpha(impactColor, 0.1)}` }}
          >
            <div className={st.contextTitle} style={{ color: impactColor }}>
              <Lightbulb size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> What This
              Means
            </div>
            <p className={st.contextText} style={{ color: C.t2 }}>
              {event.context}
            </p>
          </div>
          <div className={st.detailRow}>
            {event.history.length > 0 && (
              <div style={{ flex: 1 }}>
                <div className={st.detailLabel} style={{ color: C.t3 }}>
                  Recent Readings
                </div>
                <div className={st.historyBars}>
                  {event.history.map((v, i) => {
                    const max = Math.max(...event.history);
                    const height = max > 0 ? (v / max) * 32 : 16;
                    return (
                      <div
                        key={i}
                        className={st.histBar}
                        style={{ height: `${height}px`, background: alpha(C.b, 0.3) }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div className={st.detailLabel} style={{ color: C.t3 }}>
                Assets Affected
              </div>
              <div className={st.assetTags}>
                {event.affectedAssets.map((a) => (
                  <span key={a} className={st.assetTag} style={{ color: C.t2, background: alpha(C.t3, 0.1) }}>
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
export default React.memo(EconomicCalendarPro);
