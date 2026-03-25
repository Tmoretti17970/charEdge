// ═══════════════════════════════════════════════════════════════════
// Morning Briefing — Active Session Content
// Live session stats, risk gauge, consecutive loss warning, best trade.
// ═══════════════════════════════════════════════════════════════════

import { fmtD } from '../../../../utils.js';
import { BriefingTile, MiniStat } from './BriefingPrimitives.jsx';
import { C, M } from '@/constants.js';

export default function ActiveSessionContent({
  stats,
  riskUsed,
  riskRemaining,
  dailyLossLimit,
  isMobile,
  _streakText,
}) {
  const isWarning = stats.consecLosses >= 3 || riskUsed >= 75;
  const isDanger = riskUsed >= 100;

  return (
    <>
      {/* Live Session Stats */}
      <BriefingTile title="SESSION STATS" isMobile={isMobile} style={{ marginRight: 10, flex: '1 1 180px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <MiniStat label="Trades" value={stats.todayCount} color={C.t1} />
          <MiniStat label="Win Rate" value={`${stats.todayWinRate}%`} color={stats.todayWinRate >= 50 ? C.g : C.r} />
          <MiniStat
            label="Streak"
            value={stats.streakType === 'win' ? `+${stats.streak}` : `-${stats.streak}`}
            color={stats.streakType === 'win' ? C.g : C.r}
          />
        </div>
      </BriefingTile>

      {/* Risk Gauge */}
      {dailyLossLimit > 0 && (
        <BriefingTile
          title={isDanger ? '⛔ LIMIT HIT' : isWarning ? '⚠️ RISK ALERT' : 'RISK BUDGET'}
          isMobile={isMobile}
          style={{
            marginRight: 10,
            flex: '0 0 auto',
            minWidth: 140,
            borderColor: isDanger ? C.r + '40' : isWarning ? C.y + '40' : undefined,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 6,
              background: C.bg2,
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, riskUsed)}%`,
                height: '100%',
                background: isDanger ? C.r : riskUsed >= 50 ? C.y : C.g,
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                fontFamily: M,
                color: isDanger ? C.r : riskUsed >= 50 ? C.y : C.g,
              }}
            >
              {riskRemaining !== null ? fmtD(riskRemaining) : '—'}
            </span>
            <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{riskUsed}% used</span>
          </div>
        </BriefingTile>
      )}

      {/* Consecutive Loss Warning */}
      {stats.consecLosses >= 2 && (
        <BriefingTile
          title="⚡ COOL DOWN"
          isMobile={isMobile}
          style={{ flex: '0 0 auto', minWidth: 130, borderColor: C.y + '40', background: C.y + '08' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: C.y }}>
            {stats.consecLosses} consecutive losses
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>Consider taking a break</div>
        </BriefingTile>
      )}

      {/* Today's Best */}
      {stats.todayBest && (stats.todayBest.pnl || 0) > 0 && (
        <BriefingTile title="🏆 TODAY'S BEST" isMobile={isMobile} style={{ flex: '0 0 auto', minWidth: 120 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color: C.g }}>
            {stats.todayBest.symbol} {fmtD(stats.todayBest.pnl)}
          </div>
        </BriefingTile>
      )}
    </>
  );
}
