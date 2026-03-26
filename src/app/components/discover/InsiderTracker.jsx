// ═══════════════════════════════════════════════════════════════════
// charEdge — Insider & Institutional Tracker
//
// Sprint 8: SEC insider & institutional activity monitor.
// ═══════════════════════════════════════════════════════════════════

import { Building, User, Flame, Star, TrendingUp, TrendingDown, List } from 'lucide-react';
import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

const MOCK_INSIDER = [
  {
    id: 1,
    date: '2026-02-24',
    symbol: 'NVDA',
    name: 'Jensen Huang',
    role: 'CEO',
    action: 'Sell',
    shares: 120000,
    price: 890.2,
    value: 106824000,
    pctHoldings: 0.3,
    cluster: false,
  },
  {
    id: 2,
    date: '2026-02-24',
    symbol: 'AAPL',
    name: 'Tim Cook',
    role: 'CEO',
    action: 'Sell',
    shares: 50000,
    price: 198.4,
    value: 9920000,
    pctHoldings: 0.8,
    cluster: false,
  },
  {
    id: 3,
    date: '2026-02-23',
    symbol: 'MSFT',
    name: 'Satya Nadella',
    role: 'CEO',
    action: 'Sell',
    shares: 30000,
    price: 415.8,
    value: 12474000,
    pctHoldings: 0.4,
    cluster: false,
  },
  {
    id: 4,
    date: '2026-02-23',
    symbol: 'JPM',
    name: 'Jamie Dimon',
    role: 'CEO',
    action: 'Buy',
    shares: 25000,
    price: 198.2,
    value: 4955000,
    pctHoldings: 0.2,
    cluster: true,
  },
  {
    id: 5,
    date: '2026-02-23',
    symbol: 'JPM',
    name: 'Mary Erdoes',
    role: 'Director',
    action: 'Buy',
    shares: 15000,
    price: 197.8,
    value: 2967000,
    pctHoldings: 1.2,
    cluster: true,
  },
  {
    id: 6,
    date: '2026-02-22',
    symbol: 'AMZN',
    name: 'Andrew Jassy',
    role: 'CEO',
    action: 'Sell',
    shares: 40000,
    price: 185.6,
    value: 7424000,
    pctHoldings: 0.5,
    cluster: false,
  },
  {
    id: 7,
    date: '2026-02-22',
    symbol: 'META',
    name: 'Mark Zuckerberg',
    role: 'CEO',
    action: 'Sell',
    shares: 200000,
    price: 498.4,
    value: 99680000,
    pctHoldings: 0.1,
    cluster: false,
  },
  {
    id: 8,
    date: '2026-02-21',
    symbol: 'TSLA',
    name: 'Robyn Denholm',
    role: 'Chair',
    action: 'Sell',
    shares: 18000,
    price: 248.5,
    value: 4473000,
    pctHoldings: 2.5,
    cluster: false,
  },
  {
    id: 9,
    date: '2026-02-21',
    symbol: 'GS',
    name: 'David Solomon',
    role: 'CEO',
    action: 'Buy',
    shares: 8000,
    price: 412.8,
    value: 3302400,
    pctHoldings: 0.6,
    cluster: true,
  },
  {
    id: 10,
    date: '2026-02-21',
    symbol: 'GS',
    name: 'John Waldron',
    role: 'COO',
    action: 'Buy',
    shares: 5000,
    price: 413.2,
    value: 2066000,
    pctHoldings: 0.9,
    cluster: true,
  },
  {
    id: 11,
    date: '2026-02-20',
    symbol: 'HD',
    name: 'Ted Decker',
    role: 'CEO',
    action: 'Buy',
    shares: 12000,
    price: 378.5,
    value: 4542000,
    pctHoldings: 1.8,
    cluster: false,
  },
  {
    id: 12,
    date: '2026-02-20',
    symbol: 'LLY',
    name: 'David Ricks',
    role: 'CEO',
    action: 'Sell',
    shares: 22000,
    price: 785.2,
    value: 17274400,
    pctHoldings: 0.3,
    cluster: false,
  },
];

const CONGRESS_TRADES = [
  {
    id: 'c1',
    date: '2026-02-23',
    member: 'Sen. T. Tuberville',
    party: 'R',
    symbol: 'NVDA',
    action: 'Buy',
    amount: '$250K–$500K',
  },
  {
    id: 'c2',
    date: '2026-02-22',
    member: 'Rep. N. Pelosi',
    party: 'D',
    symbol: 'GOOGL',
    action: 'Buy',
    amount: '$1M–$5M',
  },
  {
    id: 'c3',
    date: '2026-02-21',
    member: 'Sen. M. Kelly',
    party: 'D',
    symbol: 'MSFT',
    action: 'Buy',
    amount: '$100K–$250K',
  },
  {
    id: 'c4',
    date: '2026-02-20',
    member: 'Rep. D. Crenshaw',
    party: 'R',
    symbol: 'XOM',
    action: 'Sell',
    amount: '$50K–$100K',
  },
];

function InsiderTracker() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('insider'); // 'insider' | 'congress'
  const [filter, setFilter] = useState('all'); // 'all' | 'buys' | 'sells' | 'watchlist' | 'clusters'
  const watchlist = useWatchlistStore((s) => s.items);

  const filtered = useMemo(() => {
    let data = MOCK_INSIDER;
    if (filter === 'buys') data = data.filter((d) => d.action === 'Buy');
    else if (filter === 'sells') data = data.filter((d) => d.action === 'Sell');
    else if (filter === 'clusters') data = data.filter((d) => d.cluster);
    else if (filter === 'watchlist') {
      const syms = new Set(watchlist.map((w) => w.symbol));
      data = data.filter((d) => syms.has(d.symbol));
    }
    return data;
  }, [filter, watchlist]);

  const clusterCount = MOCK_INSIDER.filter((d) => d.cluster).length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
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
          <Building size={18} color={C.t1} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            Insider & Institutional Tracker
          </h3>
          {clusterCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.g,
                background: alpha(C.g, 0.1),
                padding: '2px 7px',
                borderRadius: 4,
                fontFamily: 'var(--tf-mono)',
              }}
            >
              {clusterCount} cluster buys
            </span>
          )}
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
          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[
              { id: 'insider', label: 'Insider Trades', icon: User },
              { id: 'congress', label: 'Congress Trades', icon: Building },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="tf-btn"
                style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: `1px solid ${tab === t.id ? C.b : 'transparent'}`,
                  background: tab === t.id ? alpha(C.b, 0.08) : 'transparent',
                  color: tab === t.id ? C.b : C.t3,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--tf-font)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <t.icon size={12} /> {t.label}
                </span>
              </button>
            ))}
          </div>

          {tab === 'insider' ? (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                {['all', 'buys', 'sells', 'clusters', 'watchlist'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="tf-btn"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid ${filter === f ? C.p : 'transparent'}`,
                      background: filter === f ? alpha(C.p, 0.08) : 'transparent',
                      color: filter === f ? C.p : C.t3,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'var(--tf-font)',
                      textTransform: 'capitalize',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {f === 'clusters' ? (
                        <>
                          <Flame size={12} /> Clusters
                        </>
                      ) : f === 'watchlist' ? (
                        <>
                          <Star size={12} /> Watchlist
                        </>
                      ) : f === 'buys' ? (
                        <>
                          <TrendingUp size={12} /> Buys
                        </>
                      ) : f === 'sells' ? (
                        <>
                          <TrendingDown size={12} /> Sells
                        </>
                      ) : (
                        <>
                          <List size={12} /> All
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {/* Insider Trades List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: C.t3,
                      fontSize: 12,
                      fontFamily: 'var(--tf-font)',
                    }}
                  >
                    No insider trades match your filter.
                  </div>
                ) : (
                  filtered.map((trade) => (
                    <div
                      key={trade.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: alpha(C.sf, trade.cluster ? 0.8 : 0.4),
                        border: `1px solid ${trade.cluster ? alpha(C.g, 0.2) : alpha(C.bd, 0.3)}`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ minWidth: 55 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                          {trade.symbol}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
                          {trade.date.slice(5)}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                          {trade.name}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)' }}>{trade.role}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'var(--tf-font)',
                          color: trade.action === 'Buy' ? C.g : C.r,
                          background: alpha(trade.action === 'Buy' ? C.g : C.r, 0.1),
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {trade.action}
                      </span>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-mono)' }}>
                          ${(trade.value / 1e6).toFixed(1)}M
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
                          {trade.shares.toLocaleString()} sh
                        </div>
                      </div>
                      {trade.cluster && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.g,
                            background: alpha(C.g, 0.12),
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontFamily: 'var(--tf-font)',
                          }}
                        >
                          CLUSTER
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Congress Trades */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {CONGRESS_TRADES.map((ct) => (
                <div
                  key={ct.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: alpha(C.sf, 0.4),
                    border: `1px solid ${alpha(C.bd, 0.3)}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ minWidth: 55 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                      {ct.symbol}
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-mono)' }}>{ct.date.slice(5)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                      {ct.member}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: ct.party === 'D' ? C.info : C.r,
                        fontFamily: 'var(--tf-font)',
                      }}
                    >
                      ({ct.party})
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--tf-font)',
                      color: ct.action === 'Buy' ? C.g : C.r,
                      background: alpha(ct.action === 'Buy' ? C.g : C.r, 0.1),
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {ct.action}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: 'var(--tf-mono)' }}>
                    {ct.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { InsiderTracker };

export default React.memo(InsiderTracker);
