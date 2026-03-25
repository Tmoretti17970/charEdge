// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Institutional Money Panel
//
// Side panel showing institutional data from SEC EDGAR & FINRA:
//   - Short Interest (bi-monthly SI + days-to-cover)
//   - Short Sale Volume (daily short ratio)
//   - Dark Pool / ATS Volume (weekly)
//   - 13F Holdings (quarterly hedge fund positions)
//
// Usage:
//   <InstitutionalPanel symbol="AAPL" />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import { logger } from '@/observability/logger';

// ─── Styles ────────────────────────────────────────────────────

const S = {
  container: {
    fontFamily: 'var(--tf-font)',
    color: C.t1,
    padding: '16px 20px',
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    marginBottom: 20,
    background: `${C.bg2 || '#1a1d23'}`,
    borderRadius: 10,
    padding: '12px 14px',
    border: `1px solid ${C.bd}`,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: C.t2,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: 13,
    borderBottom: `1px solid ${C.bd}22`,
  },
  label: { color: C.t3, fontSize: 12 },
  val: { fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 13 },
  bar: {
    height: 6,
    borderRadius: 3,
    transition: 'width 0.4s ease',
  },
  barContainer: {
    height: 6,
    borderRadius: 3,
    background: `${C.t3}15`,
    flex: 1,
    marginLeft: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    fontSize: 12,
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    color: C.t3,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '6px 4px',
    borderBottom: `1px solid ${C.bd}`,
  },
  td: {
    padding: '6px 4px',
    borderBottom: `1px solid ${C.bd}22`,
    fontVariantNumeric: 'tabular-nums',
  },
  badge: (color) => ({
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    background: `${color}20`,
    color,
  }),
  empty: {
    textAlign: 'center',
    color: C.t3,
    fontSize: 13,
    padding: '24px 0',
    opacity: 0.7,
  },
  tab: (active) => ({
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? C.t1 : C.t3,
    background: active ? `${C.b}18` : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
};

// ─── Formatters ────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Panel Component ───────────────────────────────────────────

function InstitutionalPanel({ symbol = 'AAPL' }) {
  const [tab, setTab] = useState('short');
  const [shortInterest, setShortInterest] = useState([]);
  const [shortSaleVol, setShortSaleVol] = useState([]);
  const [darkPool, setDarkPool] = useState([]);
  const [_holdings, _setHoldings] = useState([]);
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isEquity = useMemo(() => /^[A-Z]{1,5}$/.test((symbol || '').toUpperCase()), [symbol]);

  // Fetch data on symbol change
  useEffect(() => {
    if (!isEquity) {
      setLoading(false);
      setError('Institutional data is only available for US equities');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadInstitutionalData = async () => {
      try {
        // Dynamic imports to code-split
        const [finraMod, edgarMod] = await Promise.all([
          import('../../../data/adapters/FinraAdapter.js'),
          import('../../../data/adapters/EdgarAdapter.js'),
        ]);

        const finra = finraMod.finraAdapter;
        const _edgar = edgarMod.edgarAdapter;

        // Fetch all in parallel
        const [si, ssv, dp] = await Promise.allSettled([
          finra.fetchShortInterest(symbol, 12),
          finra.fetchShortSaleVolume(symbol, 30),
          finra.fetchDarkPoolVolume(symbol, 12),
        ]);

        if (cancelled) return;

        setShortInterest(si.status === 'fulfilled' ? si.value : []);
        setShortSaleVol(ssv.status === 'fulfilled' ? ssv.value : []);
        setDarkPool(dp.status === 'fulfilled' ? dp.value : []);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadInstitutionalData();
    return () => {
      cancelled = true;
    };
  }, [symbol, isEquity]);

  // Watch symbol for real-time SEC filings
  useEffect(() => {
    if (!isEquity) return;
    let unsubscribe;
    (async () => {
      try {
        const { secFilingMonitor } = await import('../../../data/engine/market/SECFilingMonitor.js');
        await secFilingMonitor.watch(symbol);
        // Load cached filings
        setFilings(secFilingMonitor.getRecentFilings(symbol, 30));
        // Subscribe to new filings
        unsubscribe = secFilingMonitor.onFiling((filing) => {
          if (filing.symbol === symbol.toUpperCase()) {
            setFilings((prev) => [filing, ...prev].slice(0, 50));
          }
        });
      } catch (e) {
        logger.ui.warn('Operation failed', e);
      }
    })();
    return () => {
      if (unsubscribe) unsubscribe();
      import('../../../data/engine/market/SECFilingMonitor.js')
        .then((m) => m.secFilingMonitor.unwatch(symbol))
        .catch(() => {}); // intentional: cleanup unwatch is best-effort
    };
  }, [symbol, isEquity]);

  // Computed metrics
  const latestSI = shortInterest[0];
  const _latestSSV = shortSaleVol[0];
  const _latestDP = darkPool[0];
  const avgShortRatio = useMemo(() => {
    if (!shortSaleVol.length) return 0;
    return shortSaleVol.reduce((sum, d) => sum + d.shortRatio, 0) / shortSaleVol.length;
  }, [shortSaleVol]);

  if (!isEquity) {
    return (
      <div style={S.container}>
        <div style={S.header}>🏛 Institutional Data</div>
        <div style={S.empty}>
          Institutional data (short interest, dark pools, 13F filings) is only available for US-listed equities.
          <br />
          <br />
          Switch to a US equity symbol like <strong>AAPL</strong>, <strong>TSLA</strong>, or <strong>SPY</strong>.
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>🏛 Institutional Data — {symbol.toUpperCase()}</div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: `${C.t3}10`, borderRadius: 8, padding: 3 }}>
        <button style={S.tab(tab === 'short')} onClick={() => setTab('short')}>
          Short Interest
        </button>
        <button style={S.tab(tab === 'darkpool')} onClick={() => setTab('darkpool')}>
          Dark Pool
        </button>
        <button style={S.tab(tab === 'filings')} onClick={() => setTab('filings')}>
          Filings
        </button>
        <button style={S.tab(tab === 'holdings')} onClick={() => setTab('holdings')}>
          13F Holdings
        </button>
      </div>

      {loading && <div style={S.empty}>Loading institutional data…</div>}
      {error && <div style={{ ...S.empty, color: '#f44336' }}>{error}</div>}

      {!loading && !error && tab === 'short' && (
        <>
          {/* Summary Cards */}
          <div style={S.section}>
            <div style={S.sectionTitle}>📉 Short Interest Summary</div>
            <div style={S.row}>
              <span style={S.label}>Short Interest</span>
              <span style={S.val}>{fmtNum(latestSI?.shortInterest)}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Days to Cover</span>
              <span
                style={{
                  ...S.val,
                  color:
                    (latestSI?.daysToCover || 0) > 5
                      ? '#f44336'
                      : (latestSI?.daysToCover || 0) > 2
                        ? '#FFA726'
                        : '#4CAF50',
                }}
              >
                {latestSI?.daysToCover?.toFixed(1) || '—'}
              </span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Change</span>
              <span style={{ ...S.val, color: (latestSI?.changePercent || 0) > 0 ? '#f44336' : '#4CAF50' }}>
                {latestSI?.changePercent
                  ? `${latestSI.changePercent > 0 ? '+' : ''}${latestSI.changePercent.toFixed(1)}%`
                  : '—'}
              </span>
            </div>
            <div style={S.row}>
              <span style={S.label}>Avg Short Sale Ratio (30d)</span>
              <span style={{ ...S.val, color: avgShortRatio > 50 ? '#f44336' : avgShortRatio > 30 ? '#FFA726' : C.t1 }}>
                {fmtPct(avgShortRatio)}
              </span>
            </div>
          </div>

          {/* Short Sale Volume Chart */}
          <div style={S.section}>
            <div style={S.sectionTitle}>📊 Daily Short Sale Ratio</div>
            {shortSaleVol.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {shortSaleVol.slice(0, 15).map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ color: C.t3, width: 72, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {d.date}
                    </span>
                    <div style={S.barContainer}>
                      <div
                        style={{
                          ...S.bar,
                          width: `${Math.min(d.shortRatio, 100)}%`,
                          background: d.shortRatio > 50 ? '#f44336' : d.shortRatio > 30 ? '#FFA726' : '#4CAF50',
                        }}
                      />
                    </div>
                    <span style={{ ...S.val, width: 40, textAlign: 'right', fontSize: 11 }}>
                      {d.shortRatio.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.empty}>No short sale volume data available</div>
            )}
          </div>

          {/* Short Interest History Table */}
          <div style={S.section}>
            <div style={S.sectionTitle}>📅 Historical Short Interest</div>
            {shortInterest.length > 0 ? (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Date</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>SI</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Chg %</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>DTC</th>
                  </tr>
                </thead>
                <tbody>
                  {shortInterest.map((d, i) => (
                    <tr key={i}>
                      <td style={S.td}>{d.settlementDate}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{fmtNum(d.shortInterest)}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: d.changePercent > 0 ? '#f44336' : '#4CAF50' }}>
                        {d.changePercent ? `${d.changePercent > 0 ? '+' : ''}${d.changePercent.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{d.daysToCover?.toFixed(1) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={S.empty}>No short interest data available</div>
            )}
          </div>
        </>
      )}

      {!loading && !error && tab === 'darkpool' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>🌑 Dark Pool (ATS) Weekly Volume</div>
          {darkPool.length > 0 ? (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Week Of</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Trades</th>
                </tr>
              </thead>
              <tbody>
                {darkPool.map((d, i) => (
                  <tr key={i}>
                    <td style={S.td}>{d.weekOf}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtNum(d.totalShares)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtNum(d.totalTrades)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={S.empty}>No dark pool data available for {symbol}</div>
          )}
        </div>
      )}

      {!loading && !error && tab === 'filings' && (
        <div style={S.section}>
          <div style={S.sectionTitle}>📄 Recent SEC Filings</div>
          {filings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filings.map((f, i) => (
                <a
                  key={f.accessionNumber || i}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: `${C.t3}08`,
                    textDecoration: 'none',
                    color: C.t1,
                    border: `1px solid ${C.bd}22`,
                    transition: 'background 0.15s ease',
                    fontSize: 12,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = `${C.b}12`)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = `${C.t3}08`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span
                      style={S.badge(
                        f.type?.includes('8-K')
                          ? '#FFA726'
                          : f.type?.includes('10-K')
                            ? '#4CAF50'
                            : f.type?.includes('13F')
                              ? '#2196F3'
                              : f.type?.includes('4')
                                ? '#AB47BC'
                                : C.t2,
                      )}
                    >
                      {f.type}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.title || f.description || f.type}
                    </span>
                  </div>
                  <span
                    style={{
                      color: C.t3,
                      fontSize: 11,
                      flexShrink: 0,
                      marginLeft: 8,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {f.date}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div style={S.empty}>No recent filings found for {symbol}. Monitoring will continue automatically.</div>
          )}
        </div>
      )}

      {!loading && !error && tab === 'holdings' && <Holdings13F symbol={symbol} />}
    </div>
  );
}

// ─── 13F Holdings Sub-Component ────────────────────────────────

function Holdings13F({ symbol }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [selectedFund, setSelectedFund] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  // Search for institutional investors
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try {
      const { edgarAdapter } = await import('../../../data/adapters/EdgarAdapter.js');
      const results = await edgarAdapter.searchInstitutions(searchQuery, 10);
      setInstitutions(results);
    } catch {
      setInstitutions([]);
    }
    setLoadingSearch(false);
  }, [searchQuery]);

  // Load holdings for selected fund
  useEffect(() => {
    if (!selectedFund) return;
    let cancelled = false;
    setLoadingHoldings(true);

    (async () => {
      try {
        const { edgarAdapter } = await import('../../../data/adapters/EdgarAdapter.js');
        const h = await edgarAdapter.fetch13FHoldings(selectedFund.cik, 30);
        if (!cancelled) setHoldings(h);
      } catch {
        if (!cancelled) setHoldings([]);
      }
      if (!cancelled) setLoadingHoldings(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFund]);

  return (
    <>
      {/* Search */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🔍 Search Institutional Investor</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Berkshire, Citadel, Bridgewater…"
            style={{
              flex: 1,
              background: `${C.t3}10`,
              border: `1px solid ${C.bd}`,
              borderRadius: 6,
              color: C.t1,
              padding: '6px 10px',
              fontSize: 12,
              fontFamily: 'var(--tf-font)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loadingSearch}
            style={{
              background: `${C.b}`,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loadingSearch ? 0.6 : 1,
            }}
          >
            {loadingSearch ? '…' : 'Search'}
          </button>
        </div>

        {/* Institution Results */}
        {institutions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {institutions.map((inst, i) => (
              <button
                key={i}
                onClick={() => setSelectedFund(inst)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: selectedFund?.cik === inst.cik ? `${C.b}18` : 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${C.bd}22`,
                  color: C.t1,
                  padding: '8px 6px',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                  fontFamily: 'var(--tf-font)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{inst.name}</div>
                <div style={{ color: C.t3, fontSize: 10, marginTop: 2 }}>CIK: {inst.cik}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Holdings Table */}
      {selectedFund && (
        <div style={S.section}>
          <div style={S.sectionTitle}>📊 {selectedFund.name} — Top Holdings</div>
          {loadingHoldings ? (
            <div style={S.empty}>Loading 13F holdings…</div>
          ) : holdings.length > 0 ? (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Issuer</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Value</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Shares</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => (
                  <tr
                    key={i}
                    style={{
                      background: h.nameOfIssuer.toUpperCase().includes(symbol.toUpperCase())
                        ? `${C.b}10`
                        : 'transparent',
                    }}
                  >
                    <td style={S.td}>
                      <div
                        style={{ fontWeight: h.nameOfIssuer.toUpperCase().includes(symbol.toUpperCase()) ? 700 : 400 }}
                      >
                        {h.nameOfIssuer}
                      </div>
                      <div style={{ color: C.t3, fontSize: 10 }}>{h.titleOfClass}</div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtMoney(h.value)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtNum(h.shares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={S.empty}>No 13F holdings found</div>
          )}
        </div>
      )}

      {/* Suggested top funds */}
      {!selectedFund && institutions.length === 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>💡 Try Searching</div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
            Search for any institutional investor to view their quarterly 13F holdings from SEC filings.
            <br />
            <br />
            Popular searches: <strong>Berkshire</strong>, <strong>Citadel</strong>, <strong>Bridgewater</strong>,
            <strong> Renaissance</strong>, <strong>Vanguard</strong>, <strong>BlackRock</strong>
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(InstitutionalPanel);
