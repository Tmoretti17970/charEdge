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

import { useState, useEffect, useMemo, useCallback } from 'react';
import s from './StockInfoPanel.module.css';
import { isCrypto } from '@/constants.js';
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

  const baseSym = useMemo(() => (symbol || '').toUpperCase().replace(/USDT$|BUSD$|USD$/, ''), [symbol]);

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
          if (e) setEarnings(e.filter((x) => x.symbol === baseSym).slice(0, 8));
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isEquity) {
    return (
      <div className={s.cryptoFallback}>
        <div className={s.cryptoIcon}>📊</div>
        <div className={s.cryptoMsg}>Fundamentals are available for stocks and ETFs.</div>
        <div className={s.cryptoSub}>{baseSym} is a crypto asset.</div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      {/* Tab Bar */}
      <div className={s.tabBar}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={s.tabBtn} data-active={tab === t || undefined}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={s.content}>
        {loading && <div className={s.loading}>Loading...</div>}

        {!loading && tab === 'Profile' && profile && <ProfileView data={profile} />}

        {!loading && tab === 'Analysts' && recommendations && <AnalystsView data={recommendations} />}

        {!loading && tab === 'Earnings' && earnings && <EarningsView data={earnings} />}

        {!loading && tab === 'News' && news && <NewsView data={news} />}

        {!loading && tab === 'Insiders' && insiders && <InsidersView data={insiders} />}
      </div>
    </div>
  );
}

// ─── Sub-Views ───────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className={s.infoRow}>
      <span className={s.infoRowLabel}>{label}</span>
      <span className={s.infoRowValue}>{value}</span>
    </div>
  );
}

function ProfileView({ data }) {
  return (
    <div className={s.profileWrap}>
      {data.logo && (
        <div className={s.profileHeader}>
          <img src={data.logo} alt="" className={s.profileLogo} />
          <div>
            <div className={s.profileName}>{data.name}</div>
            <div className={s.profileExchange}>
              {data.exchange} · {data.ticker}
            </div>
          </div>
        </div>
      )}
      <InfoRow label="Sector" value={data.finnhubIndustry} />
      <InfoRow
        label="Market Cap"
        value={data.marketCapitalization ? `$${(data.marketCapitalization / 1000).toFixed(1)}B` : null}
      />
      <InfoRow label="IPO Date" value={data.ipo} />
      <InfoRow label="Country" value={data.country} />
      <InfoRow label="Phone" value={data.phone} />
      <InfoRow label="Employees" value={data.employeeTotal?.toLocaleString()} />
      {data.weburl && (
        <a href={data.weburl} target="_blank" rel="noopener noreferrer" className={s.profileLink}>
          {data.weburl} ↗
        </a>
      )}
    </div>
  );
}

function AnalystsView({ data }) {
  if (!data.length) return <div className={s.emptyState}>No analyst data available.</div>;
  const latest = data[0];
  const total =
    (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongBuy || 0) + (latest.strongSell || 0);
  if (!total) return null;

  const segments = [
    { label: 'Strong Buy', count: latest.strongBuy || 0, color: '#00c853' },
    { label: 'Buy', count: latest.buy || 0, color: '#66bb6a' },
    { label: 'Hold', count: latest.hold || 0, color: '#ffa726' },
    { label: 'Sell', count: latest.sell || 0, color: '#ef5350' },
    { label: 'Strong Sell', count: latest.strongSell || 0, color: '#b71c1c' },
  ];

  return (
    <div className={s.analystsWrap}>
      <div className={s.analystsPeriod}>
        {latest.period} · {total} analysts
      </div>
      {/* Horizontal bar */}
      <div className={s.analystsBar}>
        {segments
          .filter((seg) => seg.count > 0)
          .map((seg, i) => (
            <div
              key={i}
              className={s.analystsSegment}
              style={{
                '--seg-width': `${(seg.count / total) * 100}%`,
                '--seg-color': seg.color,
                width: `${(seg.count / total) * 100}%`,
                background: seg.color,
                minWidth: seg.count > 0 ? 18 : 0,
              }}
            >
              {seg.count}
            </div>
          ))}
      </div>
      {/* Legend */}
      <div className={s.analystsLegend}>
        {segments
          .filter((seg) => seg.count > 0)
          .map((seg, i) => (
            <div key={i} className={s.legendItem}>
              <div className={s.legendDot} style={{ background: seg.color }} />
              {seg.label}
            </div>
          ))}
      </div>
    </div>
  );
}

function EarningsView({ data }) {
  if (!data.length) return <div className={s.emptyState}>No earnings data available.</div>;
  return (
    <div className={s.earningsWrap}>
      <div className={s.earningsHeader}>
        <span className={s.earningsCol}>Date</span>
        <span className={`${s.earningsCol} ${s['earningsCol--right']}`}>EPS Est</span>
        <span className={`${s.earningsCol} ${s['earningsCol--right']}`}>EPS Act</span>
        <span className={`${s.earningsCol} ${s['earningsCol--right']}`}>Surprise</span>
      </div>
      {data.map((e, i) => {
        const surprise =
          e.epsActual != null && e.epsEstimate != null
            ? (((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate || 1)) * 100).toFixed(1)
            : null;
        const beat = surprise && parseFloat(surprise) > 0;
        return (
          <div key={i} className={s.earningsRow}>
            <span className={`${s.earningsCol} ${s['earningsCol--date']}`}>{e.date}</span>
            <span className={`${s.earningsCol} ${s['earningsCol--right']}`}>{e.epsEstimate?.toFixed(2) ?? '—'}</span>
            <span className={`${s.earningsCol} ${s['earningsCol--right']} ${s['earningsCol--actual']}`}>
              {e.epsActual?.toFixed(2) ?? '—'}
            </span>
            <span
              className={`${s.earningsCol} ${s['earningsCol--right']} ${s['earningsCol--surprise']}`}
              style={{ '--surprise-color': beat ? '#00c853' : surprise ? '#ef5350' : undefined }}
              data-beat={beat || undefined}
              data-miss={surprise && !beat ? true : undefined}
            >
              {surprise ? `${beat ? '+' : ''}${surprise}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NewsView({ data }) {
  if (!data.length) return <div className={s.emptyState}>No recent news.</div>;
  return (
    <div className={s.newsWrap}>
      {data.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className={s.newsCard}>
          <div className={s.newsHeadline}>{n.headline}</div>
          <div className={s.newsMeta}>
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
  if (!data?.length) return <div className={s.emptyState}>No insider transactions.</div>;
  return (
    <div className={s.insidersWrap}>
      {data.slice(0, 15).map((tx, i) => {
        const isBuy =
          tx.transactionType?.toLowerCase().includes('buy') ||
          tx.transactionType?.toLowerCase().includes('acquisition');
        return (
          <div key={i} className={s.insiderRow}>
            <div className={s.insiderTop}>
              <span className={s.insiderName}>{tx.name}</span>
              <span className={s.insiderBadge} data-buy={isBuy}>
                {tx.transactionType}
              </span>
            </div>
            <div className={s.insiderBottom}>
              <span>{tx.filingDate}</span>
              <span>
                {tx.share?.toLocaleString()} shares @ ${tx.transactionPrice?.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
