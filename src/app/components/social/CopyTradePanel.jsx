// ═══════════════════════════════════════════════════════════════════
// charEdge — Copy Trade Panel (Tab Content)
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useSocialStore } from '../../../state/useSocialStore.js';

// ─── Mini Equity Curve ──────────────────────────────────────────
function MiniEquityCurve({ pnl = 0, width = 120, height = 32 }) {
  const seed = Math.abs(pnl) || 42;
  const pts = 20;
  const data = [];
  let val = 50;
  for (let i = 0; i < pts; i++) {
    val += (Math.sin(seed * 0.3 + i * 0.7) * 8 + (pnl > 0 ? 1.5 : -0.8));
    data.push(val);
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (pts - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  const color = pnl >= 0 ? C.g : C.r;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`eqg_${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#eqg_${seed})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Top Traders Discovery ──────────────────────────────────────
const DISCOVER_TRADERS = [
  { userId: 'disc_1', name: 'AlphaWolf', avatar: '🐺', winRate: 72, totalPnl: 34200, sharpe: 2.4, trades: 156 },
  { userId: 'disc_2', name: 'QuantFlow', avatar: '🤖', winRate: 68, totalPnl: 28900, sharpe: 2.1, trades: 243 },
  { userId: 'disc_3', name: 'NightOwl', avatar: '🦉', winRate: 65, totalPnl: 19800, sharpe: 1.9, trades: 189 },
  { userId: 'disc_4', name: 'IronHands', avatar: '💎', winRate: 71, totalPnl: 41500, sharpe: 2.6, trades: 312 },
  { userId: 'disc_5', name: 'DeltaForce', avatar: '⚡', winRate: 67, totalPnl: 22100, sharpe: 1.8, trades: 198 },
];

export default function CopyTradePanel({ onCopyTrader }) {
  const copyTargets = useSocialStore((s) => s.copyTargets);
  const copyHistory = useSocialStore((s) => s.copyHistory);
  const toggleActive = useSocialStore((s) => s.toggleActive);
  const removeCopyTarget = useSocialStore((s) => s.removeCopyTarget);
  const getTotalCopyPnl = useSocialStore((s) => s.getTotalCopyPnl);
  const [historyFilter, setHistoryFilter] = useState('all');

  const totalPnl = getTotalCopyPnl();
  const filteredHistory = historyFilter === 'all'
    ? copyHistory
    : copyHistory.filter((h) => h.traderId === historyFilter);

  const card = {
    background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16,
    padding: 20, position: 'relative', overflow: 'hidden',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* ─── Stats Overview ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Active Copies', value: copyTargets.filter((t) => t.active).length, icon: '📋', color: C.b },
          { label: 'Total P&L', value: `$${totalPnl.toLocaleString()}`, icon: '💰', color: totalPnl >= 0 ? C.g : C.r },
          { label: 'Copied Trades', value: copyHistory.length, icon: '🔄', color: C.cyan },
          { label: 'Win Rate', value: `${copyHistory.length ? Math.round((copyHistory.filter((h) => h.pnl > 0).length / copyHistory.length) * 100) : 0}%`, icon: '🎯', color: C.p },
        ].map((stat, i) => (
          <div key={i} className="tf-copy-card" style={{ ...card, textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, fontFamily: M }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Active Copies ──────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Active Copies</h2>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, background: alpha(C.t3, 0.1), padding: '3px 8px', borderRadius: 6, fontFamily: M }}>
            {copyTargets.length}
          </span>
        </div>

        {copyTargets.length === 0 ? (
          <div className="tf-copy-card" style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 6 }}>
              No Active Copy Trades
            </div>
            <div style={{ fontSize: 12, color: C.t3, fontFamily: F, marginBottom: 16 }}>
              Browse top traders below and start mirroring their trades.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {copyTargets.map((target, idx) => (
              <div key={target.userId} className="tf-copy-card" style={{ ...card, animationDelay: `${idx * 60}ms` }}>
                {/* Glow accent */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: target.active ? `linear-gradient(90deg, ${C.g}, ${C.cyan})` : C.bd,
                  borderRadius: '16px 16px 0 0',
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 28 }}>{target.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.t1, fontFamily: F, fontSize: 14 }}>{target.name}</div>
                      <div style={{ fontSize: 11, color: target.active ? C.g : C.t3, fontFamily: F }}>
                        {target.active ? '● Active' : '○ Paused'}
                      </div>
                    </div>
                  </div>
                  <MiniEquityCurve pnl={target.totalPnl || 100} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '14px 0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.b, fontFamily: M }}>{target.allocation}%</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>Allocation</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: M }}>{target.riskMultiplier}×</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>Risk</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: M }}>{target.maxPositions}</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>Max Pos</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => toggleActive(target.userId)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 8,
                      border: `1px solid ${target.active ? C.y : C.g}`,
                      background: alpha(target.active ? C.y : C.g, 0.08),
                      color: target.active ? C.y : C.g,
                      fontSize: 11, fontWeight: 700, fontFamily: F, cursor: 'pointer',
                    }}
                  >
                    {target.active ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  <button
                    onClick={() => removeCopyTarget(target.userId)}
                    style={{
                      padding: '7px 14px', borderRadius: 8,
                      border: `1px solid ${C.r}20`, background: alpha(C.r, 0.06),
                      color: C.r, fontSize: 11, fontWeight: 700, fontFamily: F, cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Copy History ───────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Copy History</h2>
        </div>

        <div style={{ ...card }}>
          {/* Table Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.6fr 0.8fr 0.8fr 0.8fr',
            gap: 8, padding: '0 0 12px', borderBottom: `1px solid ${C.bd}`,
            fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F,
          }}>
            <div>Trader</div>
            <div>Symbol</div>
            <div>Side</div>
            <div style={{ textAlign: 'right' }}>Entry</div>
            <div style={{ textAlign: 'right' }}>Exit</div>
            <div style={{ textAlign: 'right' }}>P&L</div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: C.t3 }}>
              No copy trades yet
            </div>
          ) : (
            filteredHistory.map((trade) => (
              <div
                key={trade.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.6fr 0.8fr 0.8fr 0.8fr',
                  gap: 8, padding: '10px 0', borderBottom: `1px solid ${alpha(C.bd, 0.5)}`,
                  fontSize: 12, fontFamily: F, alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 600, color: C.t1 }}>{trade.traderName}</div>
                <div style={{ color: C.t2, fontFamily: M }}>{trade.symbol}</div>
                <div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: alpha(trade.side === 'long' ? C.g : C.r, 0.1),
                    color: trade.side === 'long' ? C.g : C.r,
                  }}>
                    {trade.side.toUpperCase()}
                  </span>
                </div>
                <div style={{ textAlign: 'right', color: C.t2, fontFamily: M }}>
                  {typeof trade.entry === 'number' && trade.entry < 10 ? trade.entry.toFixed(4) : trade.entry?.toLocaleString()}
                </div>
                <div style={{ textAlign: 'right', color: C.t2, fontFamily: M }}>
                  {typeof trade.exit === 'number' && trade.exit < 10 ? trade.exit.toFixed(4) : trade.exit?.toLocaleString()}
                </div>
                <div style={{
                  textAlign: 'right', fontWeight: 700, fontFamily: M,
                  color: trade.pnl >= 0 ? C.g : C.r,
                }}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Discover Traders ───────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: F }}>Top Traders to Copy</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {DISCOVER_TRADERS.map((trader, idx) => {
            const isCopied = copyTargets.some((t) => t.userId === trader.userId);
            return (
              <div key={trader.userId} className="tf-copy-card" style={{ ...card, animationDelay: `${idx * 60}ms` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `linear-gradient(135deg, ${alpha(C.b, 0.2)}, ${alpha(C.p, 0.2)})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {trader.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: C.t1, fontFamily: F, fontSize: 14 }}>{trader.name}</div>
                    <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>{trader.trades} trades</div>
                  </div>
                  <MiniEquityCurve pnl={trader.totalPnl} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center', padding: '6px 0', background: C.sf, borderRadius: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.g, fontFamily: M }}>{trader.winRate}%</div>
                    <div style={{ fontSize: 9, color: C.t3 }}>Win Rate</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px 0', background: C.sf, borderRadius: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.b, fontFamily: M }}>${(trader.totalPnl / 1000).toFixed(1)}k</div>
                    <div style={{ fontSize: 9, color: C.t3 }}>Total P&L</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px 0', background: C.sf, borderRadius: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.p, fontFamily: M }}>{trader.sharpe}</div>
                    <div style={{ fontSize: 9, color: C.t3 }}>Sharpe</div>
                  </div>
                </div>

                <button
                  onClick={() => !isCopied && onCopyTrader?.(trader)}
                  disabled={isCopied}
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                    background: isCopied ? alpha(C.g, 0.1) : `linear-gradient(135deg, ${C.b}, ${C.bH})`,
                    color: isCopied ? C.g : '#fff',
                    fontSize: 12, fontWeight: 700, fontFamily: F,
                    cursor: isCopied ? 'default' : 'pointer',
                    opacity: isCopied ? 0.8 : 1,
                  }}
                >
                  {isCopied ? '✓ Copying' : '📋 Start Copying'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
