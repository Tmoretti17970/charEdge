// ═══════════════════════════════════════════════════════════════════
// charEdge — Stock Info Panel (Phase 3c)
//
// Surfaces Finnhub fundamentals in the chart sidebar:
//   - Company profile (sector, market cap, IPO date)
//   - Analyst recommendations (buy/sell/hold)
//   - Recent earnings (EPS, revenue)
//   - Latest news headlines
//   - Insider transactions
//
// All data is already implemented in FinnhubAdapter.js —
// this panel just surfaces it in the UI.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, isCrypto } from '@/constants.js';
import { logger } from '@/observability/logger';

const TABS = ['Profile', 'Analysts', 'Earnings', 'News', 'Insiders'];

export default function StockInfoPanel({ symbol }) {
  const [tab, setTab] = useState('Profile');
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [news, setNews] = useState(null);
  const [insiders, setInsiders] = useState(null);
  const [loading, setLoading] = useState(false);

  const baseSym = useMemo(() =>
    (symbol || '').toUpperCase().replace(/USDT$|BUSD$|USD$/, ''),
    [symbol]
  );

  const isEquity = useMemo(() => !isCrypto(baseSym), [baseSym]);

  // Fetch data for the active tab
  const fetchData = useCallback(async () => {
    if (!baseSym || !isEquity) return;
    setLoading(true);
    try {
      const { finnhubAdapter } = await import('@/data/adapters/FinnhubAdapter.js');
      switch (tab) {
        case 'Profile': {
          const p = await finnhubAdapter.fetchProfile(baseSym);
          if (p) setProfile(p);
          break;
        }
        case 'Analysts': {
          const r = await finnhubAdapter.fetchRecommendations(baseSym);
          if (r) setRecommendations(r);
          break;
        }
        case 'Earnings': {
          const now = new Date();
          const from = new Date(now.getTime() - 365 * 86400000).toISOString().split('T')[0];
          const to = now.toISOString().split('T')[0];
          const e = await finnhubAdapter.fetchEarnings(from, to);
          if (e) setEarnings(e.filter(x => x.symbol === baseSym).slice(0, 8));
          break;
        }
        case 'News': {
          const n = await finnhubAdapter.fetchNews(baseSym, 10);
          if (n) setNews(n);
          break;
        }
        case 'Insiders': {
          const ins = await finnhubAdapter.fetchInsiderTransactions(baseSym);
          if (ins) setInsiders(ins);
          break;
        }
      }
    } catch (err) {
      logger.data.warn('[StockInfoPanel] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [baseSym, tab, isEquity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!isEquity) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 13 }}>Fundamentals are available for stocks and ETFs.</div>
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>{baseSym} is a crypto asset.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.bd}`, paddingBottom: 8 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontWeight: tab === t ? 700 : 400,
              background: tab === t ? `${C.b}20` : 'transparent',
              color: tab === t ? C.b : C.t3,
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', fontSize: 12, color: C.t2 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 11 }}>
            Loading...
          </div>
        )}

        {!loading && tab === 'Profile' && profile && (
          <ProfileView data={profile} />
        )}

        {!loading && tab === 'Analysts' && recommendations && (
          <AnalystsView data={recommendations} />
        )}

        {!loading && tab === 'Earnings' && earnings && (
          <EarningsView data={earnings} />
        )}

        {!loading && tab === 'News' && news && (
          <NewsView data={news} />
        )}

        {!loading && tab === 'Insiders' && insiders && (
          <InsidersView data={insiders} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-Views ───────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.bd}22` }}>
      <span style={{ color: C.t3, fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: 11, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function ProfileView({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {data.logo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img src={data.logo} alt="" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.t1 }}>{data.name}</div>
            <div style={{ fontSize: 10, color: C.t3 }}>{data.exchange} · {data.ticker}</div>
          </div>
        </div>
      )}
      <InfoRow label="Sector" value={data.finnhubIndustry} />
      <InfoRow label="Market Cap" value={data.marketCapitalization ? `$${(data.marketCapitalization / 1000).toFixed(1)}B` : null} />
      <InfoRow label="IPO Date" value={data.ipo} />
      <InfoRow label="Country" value={data.country} />
      <InfoRow label="Phone" value={data.phone} />
      <InfoRow label="Employees" value={data.employeeTotal?.toLocaleString()} />
      {data.weburl && (
        <a
          href={data.weburl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.b, marginTop: 8, textDecoration: 'none' }}
        >
          {data.weburl} ↗
        </a>
      )}
    </div>
  );
}

function AnalystsView({ data }) {
  if (!data.length) return <div style={{ color: C.t3, padding: 12 }}>No analyst data available.</div>;
  const latest = data[0];
  const total = (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongBuy || 0) + (latest.strongSell || 0);
  if (!total) return null;

  const segments = [
    { label: 'Strong Buy', count: latest.strongBuy || 0, color: '#00c853' },
    { label: 'Buy', count: latest.buy || 0, color: '#66bb6a' },
    { label: 'Hold', count: latest.hold || 0, color: '#ffa726' },
    { label: 'Sell', count: latest.sell || 0, color: '#ef5350' },
    { label: 'Strong Sell', count: latest.strongSell || 0, color: '#b71c1c' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: C.t3, textAlign: 'center' }}>
        {latest.period} · {total} analysts
      </div>
      {/* Horizontal bar */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 20 }}>
        {segments.filter(s => s.count > 0).map((s, i) => (
          <div
            key={i}
            style={{
              width: `${(s.count / total) * 100}%`,
              background: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#fff',
              minWidth: s.count > 0 ? 18 : 0,
            }}
          >
            {s.count}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {segments.filter(s => s.count > 0).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.t3 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningsView({ data }) {
  if (!data.length) return <div style={{ color: C.t3, padding: 12 }}>No earnings data available.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', fontSize: 10, fontWeight: 700, color: C.t3, padding: '4px 0', borderBottom: `1px solid ${C.bd}` }}>
        <span style={{ flex: 1 }}>Date</span>
        <span style={{ flex: 1, textAlign: 'right' }}>EPS Est</span>
        <span style={{ flex: 1, textAlign: 'right' }}>EPS Act</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Surprise</span>
      </div>
      {data.map((e, i) => {
        const surprise = e.epsActual != null && e.epsEstimate != null
          ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate || 1) * 100).toFixed(1)
          : null;
        const beat = surprise && parseFloat(surprise) > 0;
        return (
          <div key={i} style={{ display: 'flex', padding: '5px 0', fontSize: 11, borderBottom: `1px solid ${C.bd}22` }}>
            <span style={{ flex: 1, color: C.t3 }}>{e.date}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{e.epsEstimate?.toFixed(2) ?? '—'}</span>
            <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>{e.epsActual?.toFixed(2) ?? '—'}</span>
            <span style={{
              flex: 1, textAlign: 'right', fontWeight: 600,
              color: beat ? '#00c853' : surprise ? '#ef5350' : C.t3,
            }}>
              {surprise ? `${beat ? '+' : ''}${surprise}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NewsView({ data }) {
  if (!data.length) return <div style={{ color: C.t3, padding: 12 }}>No recent news.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((n, i) => (
        <a
          key={i}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', padding: 10, borderRadius: 8,
            background: `${C.bd}15`, textDecoration: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${C.bd}30`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${C.bd}15`; }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, lineHeight: 1.4 }}>{n.headline}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: C.t3 }}>
            <span>{n.source}</span>
            <span>·</span>
            <span>{n.datetime ? new Date(n.datetime).toLocaleDateString() : ''}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function InsidersView({ data }) {
  if (!data?.length) return <div style={{ color: C.t3, padding: 12 }}>No insider transactions.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {data.slice(0, 15).map((tx, i) => {
        const isBuy = tx.transactionType?.toLowerCase().includes('buy') ||
                       tx.transactionType?.toLowerCase().includes('acquisition');
        return (
          <div key={i} style={{
            padding: '6px 0', borderBottom: `1px solid ${C.bd}22`,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 11, color: C.t1 }}>{tx.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: isBuy ? '#00c85320' : '#ef535020',
                color: isBuy ? '#00c853' : '#ef5350',
              }}>
                {tx.transactionType}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.t3 }}>
              <span>{tx.filingDate}</span>
              <span>{tx.share?.toLocaleString()} shares @ ${tx.transactionPrice?.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
