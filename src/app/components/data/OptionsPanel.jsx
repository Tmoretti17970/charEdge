// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Options Intelligence Panel
//
// Dashboard showing options market intelligence from free CBOE data:
//   - Put/Call Ratio with signal analysis
//   - VIX term structure (contango/backwardation)
//   - VIX regime classification
//   - Max Pain level (when options chain data is available)
//
// Usage:
//   <OptionsPanel symbol="SPY" />
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { logger } from '@/observability/logger';

// ─── Styles ────────────────────────────────────────────────────

const S = {
  container: {
    fontFamily: F,
    color: C.t1,
    padding: '16px 20px',
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: 800,
  },
  subtitle: {
    fontSize: 10,
    color: C.t3,
    marginTop: 2,
  },
  section: {
    background: C.sf || `${C.bg2 || '#1a1d23'}`,
    border: `1px solid ${C.bd}`,
    borderRadius: 10,
    padding: '12px 14px',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: C.t3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    fontSize: 13,
  },
  label: { color: C.t3, fontSize: 12 },
  val: { fontWeight: 600, fontFamily: M, fontVariantNumeric: 'tabular-nums', fontSize: 13 },
  badge: (bg, color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    background: bg,
    color,
    fontFamily: M,
  }),
  empty: {
    textAlign: 'center',
    color: C.t3,
    fontSize: 13,
    padding: '24px 0',
    opacity: 0.7,
  },
  btn: {
    fontSize: 10,
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${C.bd}`,
    background: C.sf || 'transparent',
    color: C.t2,
    cursor: 'pointer',
    fontFamily: M,
  },
};

// ─── Helpers ───────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ─── Mini Sparkline ────────────────────────────────────────────

function Sparkline({ data, width = 140, height = 32, color = C.b }) {
  if (!data?.length || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── VIX Term Structure Bar Chart ──────────────────────────────

function TermStructureChart({ data }) {
  if (!data?.length) return null;
  const maxPrice = Math.max(...data.map(d => d.price || 0));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginTop: 8 }}>
      {data.map((d, i) => {
        const h = maxPrice > 0 ? ((d.price || 0) / maxPrice) * 60 : 0;
        const isVIX = d.month.includes('VIX') && !d.month.includes('9-Day');
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: M, color: C.t1 }}>
              {d.price?.toFixed(1) || '—'}
            </span>
            <div style={{
              width: '100%',
              height: h,
              borderRadius: '4px 4px 0 0',
              background: isVIX ? C.b : `${C.b}60`,
              transition: 'height 0.4s ease',
            }} />
            <span style={{ fontSize: 9, color: C.t3, textAlign: 'center', lineHeight: 1.2, fontFamily: F }}>
              {d.month}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Regime Badge ──────────────────────────────────────────────

function RegimeBadge({ regime }) {
  if (!regime) return null;
  const configs = {
    extreme_low:  { emoji: '😴', bg: `#4CAF5020`, color: '#4CAF50', label: 'Complacent' },
    low:          { emoji: '😊', bg: `#4CAF5015`, color: '#66BB6A', label: 'Calm' },
    normal:       { emoji: '😐', bg: `${C.b}15`, color: C.b, label: 'Normal' },
    elevated:     { emoji: '😰', bg: `#FFA72615`, color: '#FFA726', label: 'Elevated' },
    high:         { emoji: '😱', bg: `#f4433615`, color: '#f44336', label: 'Panic' },
    extreme_high: { emoji: '🚨', bg: `#f4433625`, color: '#e53935', label: 'Crisis' },
  };
  const c = configs[regime] || configs.normal;
  return (
    <span style={S.badge(c.bg, c.color)}>
      {c.emoji} {c.label}
    </span>
  );
}

// ─── P/C Ratio Mini Chart ──────────────────────────────────────

function PCRatioChart({ data, maxItems = 20 }) {
  if (!data?.length) return null;
  const items = data.slice(0, maxItems).reverse();
  const maxRatio = Math.max(...items.map(d => d.pcRatio || 0), 1.5);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 50, marginTop: 6 }}>
      {items.map((d, i) => {
        const h = maxRatio > 0 ? ((d.pcRatio || 0) / maxRatio) * 44 : 0;
        const color = d.pcRatio > 1.0 ? '#f44336' : d.pcRatio > 0.7 ? '#FFA726' : '#4CAF50';
        return (
          <div key={i} title={`${d.date}: ${d.pcRatio?.toFixed(2)}`} style={{
            flex: 1,
            height: h,
            minWidth: 3,
            borderRadius: '2px 2px 0 0',
            background: color,
            opacity: 0.7,
            transition: 'height 0.3s ease',
          }} />
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export default function OptionsPanel({ _symbol = 'SPY' }) {
  const [pcRatioData, setPCRatioData] = useState([]);
  const [vixTermStructure, setVixTermStructure] = useState([]);
  const [vix, setVix] = useState(null);
  const [pcAnalysis, setPCAnalysis] = useState(null);
  const [vixRegime, setVixRegime] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOptionsData = useCallback(async () => {
    setLoading(true);
    try {
      const [cboeMod, engineMod] = await Promise.all([
        import('../../../data/adapters/CBOEAdapter.js'),
        import('../../../data/engine/market/OptionsIntelEngine.js'),
      ]);

      const cboe = cboeMod.cboeAdapter;
      const engine = engineMod.optionsIntelEngine;

      const [pcData, termData, vixData] = await Promise.all([
        cboe.fetchPutCallRatio(30),
        cboe.fetchVIXTermStructure(),
        cboe.fetchVIX(),
      ]);

      setPCRatioData(pcData);
      setVixTermStructure(termData);
      setVix(vixData);

      // Compute analysis
      if (pcData.length > 0) {
        setPCAnalysis(engine.analyzePCRatio(pcData[0].pcRatio, pcData));
      }
      if (vixData?.value != null) {
        setVixRegime(engine.classifyVIXRegime(vixData.value, termData));
      }
    } catch (err) {
      logger.data.warn('[OptionsPanel] Fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOptionsData();
    const interval = setInterval(fetchOptionsData, 5 * 60 * 1000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchOptionsData]);

  const latestPC = pcRatioData[0];
  const pcSparkData = useMemo(() =>
    pcRatioData.slice(0, 20).reverse().map(d => d.pcRatio),
    [pcRatioData]
  );

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>📊 Options Intelligence</div>
          <div style={S.subtitle}>Free CBOE data · P/C Ratio, VIX, Term Structure</div>
        </div>
        <button onClick={fetchOptionsData} style={S.btn}>↻ Refresh</button>
      </div>

      {loading && !vix ? (
        <div style={S.empty}>Loading options data…</div>
      ) : (
        <>
          {/* VIX Overview */}
          <div style={S.section}>
            <div style={S.sectionTitle}>🌡️ VIX — Fear Gauge</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, fontFamily: M, color: C.t1 }}>
                {vix?.value?.toFixed(1) || '—'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {vixRegime && <RegimeBadge regime={vixRegime.regime} />}
                <span style={{
                  fontSize: 12,
                  fontFamily: M,
                  fontWeight: 600,
                  color: (vix?.change || 0) >= 0 ? '#f44336' : '#4CAF50'
                }}>
                  {vix?.change >= 0 ? '+' : ''}{vix?.change?.toFixed(2) || '0.00'} ({vix?.changePct?.toFixed(1) || '0.0'}%)
                </span>
              </div>
            </div>
            {vixRegime && (
              <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5 }}>
                {vixRegime.description}
              </div>
            )}
          </div>

          {/* VIX Term Structure */}
          {vixTermStructure.length > 0 && (
            <div style={S.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={S.sectionTitle}>📈 VIX Term Structure</div>
                {vixRegime?.termShape && (
                  <span style={S.badge(
                    vixRegime.termShape === 'contango' ? '#4CAF5015' : '#FFA72615',
                    vixRegime.termShape === 'contango' ? '#4CAF50' : '#FFA726'
                  )}>
                    {vixRegime.termShape === 'contango' ? '📐 Contango' :
                     vixRegime.termShape === 'backwardation' ? '⚠️ Backwardation' : '➖ Flat'}
                  </span>
                )}
              </div>
              <TermStructureChart data={vixTermStructure} />
              <div style={{ fontSize: 10, color: C.t3, marginTop: 8 }}>
                {vixRegime?.termShape === 'contango'
                  ? 'Normal — future vol priced higher. Markets expect stability near-term.'
                  : vixRegime?.termShape === 'backwardation'
                  ? 'Inverted — near-term fear exceeds long-term. Historically rare, signals stress.'
                  : 'Flat term structure — no strong curve signal.'}
              </div>
            </div>
          )}

          {/* Put/Call Ratio */}
          <div style={S.section}>
            <div style={S.sectionTitle}>⚖️ Equity Put/Call Ratio</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: M, color: C.t1 }}>
                {latestPC?.pcRatio?.toFixed(2) || '—'}
              </span>
              <div style={{ flex: 1 }}>
                <Sparkline data={pcSparkData} width={120} height={28}
                  color={latestPC?.pcRatio > 1.0 ? '#f44336' : latestPC?.pcRatio > 0.7 ? '#FFA726' : '#4CAF50'}
                />
              </div>
            </div>
            {pcAnalysis && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={S.badge(
                    pcAnalysis.signal.includes('bullish') ? '#4CAF5015' :
                    pcAnalysis.signal.includes('bearish') ? '#f4433615' : `${C.b}15`,
                    pcAnalysis.signal.includes('bullish') ? '#4CAF50' :
                    pcAnalysis.signal.includes('bearish') ? '#f44336' : C.b,
                  )}>
                    {pcAnalysis.signal.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {pcAnalysis.zscore !== 0 && (
                    <span style={S.badge(`${C.t3}12`, C.t2)}>
                      z-score: {pcAnalysis.zscore}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5 }}>
                  {pcAnalysis.description}
                </div>
              </>
            )}
          </div>

          {/* P/C Ratio History */}
          {pcRatioData.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>📊 30-Day P/C History</div>
              <PCRatioChart data={pcRatioData} maxItems={30} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: C.t3 }}>
                <span>30d ago</span>
                <span>Today</span>
              </div>
              {/* Volume stats */}
              {latestPC && (
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11 }}>
                  <div>
                    <span style={{ color: C.t3 }}>Calls: </span>
                    <span style={{ fontWeight: 600, fontFamily: M, color: '#4CAF50' }}>{fmtNum(latestPC.callVolume)}</span>
                  </div>
                  <div>
                    <span style={{ color: C.t3 }}>Puts: </span>
                    <span style={{ fontWeight: 600, fontFamily: M, color: '#f44336' }}>{fmtNum(latestPC.putVolume)}</span>
                  </div>
                  <div>
                    <span style={{ color: C.t3 }}>Total: </span>
                    <span style={{ fontWeight: 600, fontFamily: M }}>{fmtNum(latestPC.totalVolume)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Educational note */}
          <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.6, opacity: 0.7, padding: '0 4px' }}>
            💡 <strong>Reading the P/C ratio:</strong> &gt;1.0 = more puts traded (bearish sentiment), &lt;0.7 = more calls (bullish).
            Extreme readings are often contrarian signals. VIX term structure in backwardation signals acute fear.
          </div>
        </>
      )}
    </div>
  );
}
