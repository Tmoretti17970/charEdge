// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Summary Card (H2.3)
//
// Renders a weekly journal summary with narrative, key stats,
// top symbols, emotion breakdown, and key moments timeline.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';

export default function WeeklySummaryCard({ summary }) {
  if (!summary || summary.tradeCount === 0) {
    return (
      <div style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 14,
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t2, fontFamily: F }}>
          No trades this week
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4 }}>
          Take some trades and come back for your weekly summary.
        </div>
      </div>
    );
  }

  const pnlColor = summary.netPnl >= 0 ? '#00E676' : '#EF5350';

  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>📋</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Weekly Summary
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
            Week of {summary.weekOf}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        <StatCard label="Trades" value={summary.tradeCount} />
        <StatCard label="Net P&L" value={fmtUSD(summary.netPnl)} color={pnlColor} />
        <StatCard label="Win Rate" value={`${summary.winRate}%`} color={summary.winRate >= 50 ? '#00E676' : '#EF5350'} />
      </div>

      {/* Narrative */}
      <div style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: `${C.b}06`,
        border: `1px solid ${C.b}15`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, color: C.t2, fontFamily: M, lineHeight: 1.7 }}>
          {summary.narrative}
        </div>
      </div>

      {/* Top Symbols */}
      {summary.topSymbols.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Top Symbols
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {summary.topSymbols.map(s => (
              <div key={s.symbol} style={{
                padding: '4px 10px', borderRadius: 8,
                background: `${s.pnl >= 0 ? '#00E676' : '#EF5350'}10`,
                border: `1px solid ${s.pnl >= 0 ? '#00E676' : '#EF5350'}25`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>{s.symbol}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, fontFamily: M,
                  color: s.pnl >= 0 ? '#00E676' : '#EF5350',
                }}>
                  {fmtUSD(s.pnl)}
                </span>
                <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                  ×{s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotion Breakdown */}
      {summary.emotionBreakdown.best && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Emotion Impact
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {summary.emotionBreakdown.best && (
              <EmotionChip label={`Best: "${summary.emotionBreakdown.best.emotion}"`} pnl={summary.emotionBreakdown.best.pnl} positive />
            )}
            {summary.emotionBreakdown.worst && (
              <EmotionChip label={`Worst: "${summary.emotionBreakdown.worst.emotion}"`} pnl={summary.emotionBreakdown.worst.pnl} />
            )}
          </div>
        </div>
      )}

      {/* Key Moments */}
      {summary.keyMoments.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Key Moments
          </div>
          {summary.keyMoments.map((m, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: i < summary.keyMoments.length - 1 ? `1px solid ${C.bd}` : 'none',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                background: m.pnl >= 0 ? '#00E676' : '#EF5350',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>{m.description}</div>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                  {m.date ? new Date(m.date).toLocaleDateString() : 'Unknown date'}
                </div>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, fontFamily: M,
                color: m.pnl >= 0 ? '#00E676' : '#EF5350',
              }}>
                {fmtUSD(m.pnl)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '10px 8px',
      borderRadius: 10,
      background: `${C.t3}06`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.t1, fontFamily: F, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function EmotionChip({ label, pnl, positive }) {
  const color = positive ? '#00E676' : '#EF5350';
  return (
    <div style={{
      flex: 1,
      padding: '8px 10px', borderRadius: 8,
      background: `${color}08`, border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: M, marginTop: 2 }}>{fmtUSD(pnl)}</div>
    </div>
  );
}

function fmtUSD(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
