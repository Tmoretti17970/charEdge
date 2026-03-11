// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Profit Heatmap
// Day of Week vs Hour of Day matrix visualization
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';

/**
 * @param {Array} matrix - 7x24 array of { pnl, count, wins, winRate }
 */
export default function ProfitHeatmap({ matrix }) {
  if (!matrix || matrix.length !== 7) return null;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find max absolute P&L to scale colors
  let maxAbsPnl = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const cell = matrix[d][h];
      if (cell && Math.abs(cell.pnl) > maxAbsPnl) {
        maxAbsPnl = Math.abs(cell.pnl);
      }
    }
  }

  // Prevent divide by zero
  if (maxAbsPnl === 0) maxAbsPnl = 1;

  const getCellColor = (pnl) => {
    if (pnl === 0) return C.bg2; // Empty or breakeven
    const intensity = Math.max(0.1, Math.min(1, Math.abs(pnl) / maxAbsPnl));
    // Use RGBA for transparency scaling
    if (pnl > 0) {
      return `rgba(45, 212, 160, ${intensity})`; // C.g
    } else {
      return `rgba(242, 92, 92, ${intensity})`; // C.r
    }
  };

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ minWidth: 600 }}>
        {/* Header row (Hours) */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, marginBottom: 4 }}>
          <div />
          {hours.map((h) => (
            <div
              key={h}
              style={{
                fontSize: 9,
                color: C.t3,
                fontFamily: M,
                textAlign: 'center',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Matrix rows (Days) */}
        {days.map((dayName, d) => (
          <div key={dayName} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2, marginBottom: 2 }}>
            <div
              style={{
                fontSize: 10,
                color: C.t2,
                fontFamily: M,
                display: 'flex',
                alignItems: 'center',
                fontWeight: 600,
              }}
            >
              {dayName}
            </div>
            {hours.map((h) => {
              const cell = matrix[d][h];
              const pnl = cell ? cell.pnl : 0;
              const hasTrades = cell && cell.count > 0;

              return (
                <div
                  key={h}
                  title={`${dayName} ${h}:00 - ${h}:59\nP&L: ${fmtD(pnl)}\nTrades: ${cell ? cell.count : 0}`}
                  style={{
                    height: 24,
                    background: getCellColor(pnl),
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: hasTrades ? 'help' : 'default',
                    border: hasTrades ? `1px solid rgba(255,255,255,0.05)` : 'none',
                    transition: 'transform 0.1s, filter 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (hasTrades) e.currentTarget.style.filter = 'brightness(1.5)';
                  }}
                  onMouseLeave={(e) => {
                    if (hasTrades) e.currentTarget.style.filter = 'none';
                  }}
                >
                  {/* Subtle dot if there are trades but near-zero P&L to show activity */}
                  {hasTrades && pnl === 0 && (
                     <div style={{ width: 4, height: 4, borderRadius: 2, background: C.t3 }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 10, fontFamily: M, color: C.t3 }}>
        <span>Loss</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 0.6, 0.3].map(opacity => (
            <div key={`r-${opacity}`} style={{ width: 12, height: 12, background: `rgba(242, 92, 92, ${opacity})`, borderRadius: 2 }} />
          ))}
          <div style={{ width: 12, height: 12, background: C.bg2, borderRadius: 2 }} />
          {[0.3, 0.6, 1].map(opacity => (
            <div key={`g-${opacity}`} style={{ width: 12, height: 12, background: `rgba(45, 212, 160, ${opacity})`, borderRadius: 2 }} />
          ))}
        </div>
        <span>Profit</span>
      </div>
    </div>
  );
}
