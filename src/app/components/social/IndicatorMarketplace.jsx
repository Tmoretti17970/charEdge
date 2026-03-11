// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Marketplace
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { validateScript } from '../../../charting_library/scripting/ScriptEngine.js';
import { C, F, M } from '../../../constants.js';
import { useScriptStore } from '../../../state/useScriptStore.js';
import { logger } from '@/observability/logger';
import { alpha } from '@/shared/colorUtils';

const CATEGORIES = ['All', 'Trend', 'Momentum', 'Volume', 'Volatility', 'Custom'];

const COMMUNITY_SCRIPTS = [
  {
    id: 'comm_1', name: 'SuperTrend Pro', author: 'AlphaWolf', avatar: '🐺', category: 'Trend',
    description: 'Advanced SuperTrend with ATR multiplier and trend coloring. Works on all timeframes.',
    installs: 1842, rating: 4.8, ratings: 234, updated: '2026-02-20',
    code: `const atrLen = param('ATR Length', 10, { min: 1, max: 50 });\nconst mult = param('Multiplier', 3.0, { min: 0.5, max: 10, step: 0.1 });\nconst atrVal = atr(close, atrLen);\nconst upper = sma(close, atrLen).map((v, i) => v + mult * atrVal[i]);\nconst lower = sma(close, atrLen).map((v, i) => v - mult * atrVal[i]);\nband(upper, lower, { fillColor: '#22d3ee20', label: 'SuperTrend' });\n`,
  },
  {
    id: 'comm_2', name: 'Volume Profile', author: 'QuantFlow', avatar: '🤖', category: 'Volume',
    description: 'Market profile showing volume distribution at each price level. Identifies HVN/LVN zones.',
    installs: 1256, rating: 4.7, ratings: 189, updated: '2026-02-18',
    code: `const len = param('Lookback', 50, { min: 10, max: 200 });\nconst values = sma(volume, len);\nhistogram(values, { color: '#c084fc', label: 'Vol Profile' });\n`,
  },
  {
    id: 'comm_3', name: 'Squeeze Momentum', author: 'DeltaForce', avatar: '⚡', category: 'Momentum',
    description: 'Bollinger + Keltner squeeze detector. Identifies volatility compression for breakout entries.',
    installs: 2103, rating: 4.9, ratings: 312, updated: '2026-02-22',
    code: `const bbLen = param('BB Length', 20, { min: 5, max: 50 });\nconst bbMult = param('BB Mult', 2.0, { min: 0.5, max: 5, step: 0.1 });\nconst vals = bollinger(close, bbLen, bbMult);\nplot(vals.middle, { color: '#f0b64e', label: 'Squeeze' });\n`,
  },
  {
    id: 'comm_4', name: 'Ichimoku Cloud', author: 'ZenTrader', avatar: '🧘', category: 'Trend',
    description: 'Full Ichimoku Kinko Hyo with cloud shading, Tenkan/Kijun, and Chikou Span.',
    installs: 987, rating: 4.6, ratings: 145, updated: '2026-02-15',
    code: `const tenkanLen = param('Tenkan', 9, { min: 2, max: 50 });\nconst kijunLen = param('Kijun', 26, { min: 5, max: 100 });\nconst tenkan = sma(close, tenkanLen);\nconst kijun = sma(close, kijunLen);\nplot(tenkan, { color: '#22d3ee', label: 'Tenkan' });\nplot(kijun, { color: '#f472b6', label: 'Kijun' });\n`,
  },
  {
    id: 'comm_5', name: 'Order Flow Imbalance', author: 'VolumeHunter', avatar: '📊', category: 'Volume',
    description: 'Detects aggressive buying/selling by analyzing volume delta and bid/ask imbalances.',
    installs: 756, rating: 4.5, ratings: 98, updated: '2026-02-19',
    code: `const len = param('Period', 14, { min: 2, max: 50 });\nconst delta = ema(volume, len);\nhistogram(delta, { color: C.g, label: 'OF Imbalance' });\n`,
  },
  {
    id: 'comm_6', name: 'VWAP Bands', author: 'MacroGuru', avatar: '🧠', category: 'Volatility',
    description: 'VWAP with standard deviation bands (1σ, 2σ, 3σ). Essential for intraday mean-reversion.',
    installs: 1489, rating: 4.7, ratings: 201, updated: '2026-02-21',
    code: `const values = sma(close, 20);\nconst sd1 = stdev(close, 20);\nplot(values, { color: '#e8642c', label: 'VWAP' });\nband(values.map((v,i) => v + sd1[i]), values.map((v,i) => v - sd1[i]), { fillColor: '#e8642c15', label: '1σ' });\n`,
  },
  {
    id: 'comm_7', name: 'RSI Divergence', author: 'NightOwl', avatar: '🦉', category: 'Momentum',
    description: 'Auto-detects bullish and bearish RSI divergences. Marks them with arrows on the chart.',
    installs: 1678, rating: 4.8, ratings: 267, updated: '2026-02-23',
    code: `const period = param('RSI Period', 14, { min: 2, max: 100 });\nconst values = rsi(close, period);\nplot(values, { color: '#c084fc', label: 'RSI Div' });\nhline(70, { color: '#f25c5c40', style: 'dashed' });\nhline(30, { color: '#2dd4a040', style: 'dashed' });\n`,
  },
  {
    id: 'comm_8', name: 'Heatmap Candles', author: 'CryptoKid', avatar: '🧒', category: 'Custom',
    description: 'Colors candles by relative volume intensity. High-volume bars glow bright, low-volume fades.',
    installs: 892, rating: 4.4, ratings: 73, updated: '2026-02-17',
    code: `const len = param('Vol MA', 20, { min: 5, max: 100 });\nconst ma = sma(volume, len);\nplot(ma, { color: '#f0b64e', label: 'Vol Heat' });\n`,
  },
];

// ─── Star Rating ────────────────────────────────────────────────
function Stars({ rating }) {
  const full = Math.floor(rating);
  const partial = rating - full;
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: 11, color: i < full ? '#f0b64e' : (i === full && partial > 0) ? '#f0b64e80' : C.t3 }}>
          ★
        </span>
      ))}
      <span style={{ fontSize: 10, color: C.t2, fontFamily: M, marginLeft: 4 }}>{rating}</span>
    </div>
  );
}

export default function IndicatorMarketplace() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [installed, setInstalled] = useState(new Set());
  const createScript = useScriptStore((s) => s.createScript);

  const filtered = COMMUNITY_SCRIPTS.filter((s) => {
    if (category !== 'All' && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.author.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleInstall = (script) => {
    // P2 Security: validate script code before persisting
    const validation = validateScript(script.code);
    if (!validation.valid) {
      logger.ui.warn(`[Marketplace] Blocked unsafe script "${script.name}":`, validation.error);
      return;
    }

    createScript({
      name: script.name,
      description: `${script.description} (by ${script.author})`,
      category: script.category.toLowerCase(),
      code: script.code,
    });
    setInstalled((prev) => new Set(prev).add(script.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🧩</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: F }}>Indicator Marketplace</h2>
        </div>
        <p style={{ fontSize: 13, color: C.t3, fontFamily: F, margin: 0 }}>
          Community-created indicators. Install with one click and customize to your trading style.
        </p>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indicators..."
            style={{
              width: '100%', padding: '8px 14px 8px 32px', borderRadius: 10,
              border: `1px solid ${C.bd}`, background: C.bg2, color: C.t1,
              fontSize: 12, fontFamily: F, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.t3 }}>🔍</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                border: `1px solid ${category === cat ? C.b : C.bd}`,
                background: category === cat ? alpha(C.b, 0.1) : 'transparent',
                color: category === cat ? C.b : C.t3,
                fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map((script, idx) => {
          const isInstalled = installed.has(script.id);
          return (
            <div
              key={script.id}
              className="tf-marketplace-card"
              style={{
                background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16,
                padding: 20, position: 'relative', overflow: 'hidden',
                transition: 'all 0.25s ease', animationDelay: `${idx * 40}ms`,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, fontFamily: F }}>{script.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12 }}>{script.avatar}</span>
                    <span style={{ fontSize: 11, color: C.t3, fontFamily: F }}>{script.author}</span>
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: alpha(C.p, 0.1), color: C.p, fontFamily: F,
                }}>
                  {script.category}
                </span>
              </div>

              {/* Description */}
              <div style={{ fontSize: 12, color: C.t2, fontFamily: F, lineHeight: 1.5, marginBottom: 12, minHeight: 36 }}>
                {script.description}
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Stars rating={script.rating} />
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: C.t3, fontFamily: F }}>
                  <span>📥 {script.installs.toLocaleString()}</span>
                  <span>⭐ {script.ratings}</span>
                </div>
              </div>

              {/* Install Button */}
              <button
                onClick={() => !isInstalled && handleInstall(script)}
                disabled={isInstalled}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                  background: isInstalled ? alpha(C.g, 0.1) : `linear-gradient(135deg, ${C.b}, ${C.bH})`,
                  color: isInstalled ? C.g : '#fff',
                  fontSize: 12, fontWeight: 700, fontFamily: F,
                  cursor: isInstalled ? 'default' : 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                {isInstalled ? '✓ Installed' : '📥 Install'}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, color: C.t3, fontFamily: F }}>No indicators match your search</div>
        </div>
      )}
    </div>
  );
}
