// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Performance Panel (Sprint 31)
//
// Watchlist-wide analytics: top/bottom performers, sector breakdown,
// correlation matrix, and average change metrics.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore';

// ─── Performer Row ───────────────────────────────────────────────

function PerformerRow({ item, rank }) {
  const isPositive = (item.change || 0) >= 0;
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: radii.sm,
      background: C.bg2, marginBottom: 4,
    }}>
      <span style={{ fontSize: 13, width: 22, textAlign: 'center' }}>{medal}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, flex: 1 }}>
        {item.symbol}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 700, fontFamily: M,
        color: isPositive ? C.g : C.r,
      }}>
        {isPositive ? '+' : ''}{(item.change || 0).toFixed(2)}%
      </span>
    </div>
  );
}

// ─── Donut Chart (canvas) ────────────────────────────────────────

function SectorDonut({ breakdown }) {
  const canvasRef = useRef(null);
  const COLORS = [C.b, C.g, C.p, C.y, C.cyan, C.orange, C.pink, C.r];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || breakdown.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 140 * dpr;
    canvas.height = 140 * dpr;
    ctx.scale(dpr, dpr);

    const cx = 70, cy = 70, outerR = 60, innerR = 36;
    const total = breakdown.reduce((s, b) => s + b.count, 0);
    let startAngle = -Math.PI / 2;

    breakdown.forEach((sec, i) => {
      const sweep = (sec.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
      ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      startAngle += sweep;
    });

    // Center text
    ctx.fillStyle = C.t1;
    ctx.font = `bold 18px ${F}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), cx, cy - 6);
    ctx.fillStyle = C.t3;
    ctx.font = `600 9px ${M}`;
    ctx.fillText('ASSETS', cx, cy + 10);
  }, [breakdown]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <canvas ref={canvasRef} style={{ width: 140, height: 140 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {breakdown.map((sec, i) => (
          <div key={sec.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: COLORS[i % COLORS.length], flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: C.t2, fontFamily: F, flex: 1 }}>
              {sec.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: M }}>
              {sec.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Correlation Cell ────────────────────────────────────────────

function CorrCell({ val }) {
  const abs = Math.abs(val);
  const bg = val > 0 ? `rgba(76,175,80,${abs * 0.4})` : `rgba(244,67,54,${abs * 0.4})`;
  return (
    <td style={{
      padding: '4px 6px', fontSize: 10, fontWeight: 700,
      fontFamily: M, color: C.t1, textAlign: 'center',
      background: bg, borderRadius: 2,
    }}>
      {val.toFixed(2)}
    </td>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────

function MarketsPerformancePanel({ open, onClose }) {
  const [timeframe, setTimeframe] = useState('1d');
  const items = useWatchlistStore((s) => s.items);

  // Mock changes for different timeframes
  const enrichedItems = useMemo(() => {
    return (items || []).map(item => {
      const base = item.change24h || (Math.random() * 20 - 10);
      const mult = timeframe === '1w' ? 2.5 : timeframe === '1m' ? 5 : 1;
      return { ...item, change: base * mult * (0.5 + Math.random()) };
    });
  }, [items, timeframe]);

  // Top/Bottom performers
  const sorted = useMemo(() => [...enrichedItems].sort((a, b) => b.change - a.change), [enrichedItems]);
  const topPerformers = sorted.slice(0, 5);
  const bottomPerformers = sorted.slice(-5).reverse();

  // Average change
  const avgChange = useMemo(() => {
    if (enrichedItems.length === 0) return 0;
    return enrichedItems.reduce((s, i) => s + i.change, 0) / enrichedItems.length;
  }, [enrichedItems]);

  // Sector breakdown
  const sectorBreakdown = useMemo(() => {
    const counts = {};
    (items || []).forEach(i => {
      const cls = (i.assetClass || 'other').toLowerCase();
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, count]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // Simplified correlation matrix (top 5 symbols)
  const corrSymbols = sorted.slice(0, 5).map(s => s.symbol);
  const corrMatrix = useMemo(() => {
    return corrSymbols.map((_, i) =>
      corrSymbols.map((_, j) => {
        if (i === j) return 1;
        // Simplified mock
        return parseFloat((0.3 + Math.random() * 0.6 * (Math.random() > 0.3 ? 1 : -1)).toFixed(2));
      })
    );
  }, [corrSymbols.join(',')]);

  if (!open) return null;

  const timeframes = ['1d', '1w', '1m'];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 400, zIndex: 1200,
      background: C.bg,
      borderLeft: `1px solid ${C.bd}`,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column',
      animation: 'tf-slide-left 0.25s ease-out',
      fontFamily: F,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>
          📊 Performance Analytics
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.t3,
          fontSize: 18, cursor: 'pointer', padding: 4,
          borderRadius: radii.sm, transition: transition.fast,
        }}>✕</button>
      </div>

      {/* Timeframe Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 18px',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        {timeframes.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              padding: '4px 14px', borderRadius: radii.sm,
              background: timeframe === tf ? `${C.b}18` : 'transparent',
              border: `1px solid ${timeframe === tf ? C.b : C.bd}`,
              color: timeframe === tf ? C.b : C.t3,
              fontSize: 11, fontWeight: 600, fontFamily: M,
              cursor: 'pointer', textTransform: 'uppercase',
              transition: transition.fast,
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Average Change */}
        <div style={{
          padding: '12px 14px', borderRadius: radii.lg,
          background: C.bg2, marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: C.t2 }}>Watchlist Avg Change</span>
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: M,
            color: avgChange >= 0 ? C.g : C.r,
          }}>
            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
          </span>
        </div>

        {/* Top Performers */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.t3,
          fontFamily: M, textTransform: 'uppercase', marginBottom: 6,
        }}>
          🏆 Top Performers
        </div>
        {topPerformers.map((item, i) => (
          <PerformerRow key={item.symbol} item={item} rank={i} />
        ))}

        {/* Bottom Performers */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.t3,
          fontFamily: M, textTransform: 'uppercase', marginBottom: 6, marginTop: 14,
        }}>
          📉 Bottom Performers
        </div>
        {bottomPerformers.map((item, i) => (
          <PerformerRow key={item.symbol} item={item} rank={i} />
        ))}

        {/* Sector Breakdown */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.t3,
          fontFamily: M, textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
        }}>
          🥧 Sector Breakdown
        </div>
        <div style={{
          padding: '12px', borderRadius: radii.lg,
          background: C.bg2, marginBottom: 14,
        }}>
          <SectorDonut breakdown={sectorBreakdown} />
        </div>

        {/* Correlation Matrix */}
        {corrSymbols.length > 1 && (
          <>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.t3,
              fontFamily: M, textTransform: 'uppercase', marginBottom: 6, marginTop: 8,
            }}>
              🔗 Correlation Matrix
            </div>
            <div style={{
              padding: '8px', borderRadius: radii.lg,
              background: C.bg2, overflowX: 'auto',
            }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 2, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 9, fontFamily: M, color: C.t3, textAlign: 'left', padding: 4 }} />
                    {corrSymbols.map(sym => (
                      <th key={sym} style={{
                        fontSize: 9, fontFamily: M, color: C.t2,
                        textAlign: 'center', padding: 4, fontWeight: 700,
                      }}>
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corrSymbols.map((sym, i) => (
                    <tr key={sym}>
                      <td style={{
                        fontSize: 9, fontFamily: M, color: C.t2,
                        fontWeight: 700, padding: 4,
                      }}>
                        {sym}
                      </td>
                      {corrMatrix[i].map((val, j) => (
                        <CorrCell key={j} val={val} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(MarketsPerformancePanel);
