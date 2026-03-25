// ═══════════════════════════════════════════════════════════════════
// Morning Briefing — Post-Market Content
// Session grade, summary, best/worst trades, streak.
// ═══════════════════════════════════════════════════════════════════

import { fmtD } from '../../../../utils.js';
import { BriefingTile, MiniStat } from './BriefingPrimitives.jsx';
import { C, M } from '@/constants.js';

export default function PostMarketContent({ stats, isMobile, streakText }) {
  const grade =
    stats.todayCount === 0
      ? 'No Session'
      : stats.todayWinRate >= 70
        ? 'A+'
        : stats.todayWinRate >= 60
          ? 'A'
          : stats.todayWinRate >= 50
            ? 'B'
            : stats.todayWinRate >= 40
              ? 'C'
              : 'D';

  const gradeColor = grade.startsWith('A')
    ? C.g
    : grade === 'B'
      ? C.b
      : grade === 'C'
        ? C.y
        : grade === 'D'
          ? C.r
          : C.t3;

  return (
    <>
      {/* Session Grade */}
      {stats.todayCount > 0 && (
        <BriefingTile
          title="SESSION GRADE"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '0 0 auto', minWidth: 100 }}
        >
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: M, color: gradeColor, lineHeight: 1 }}>{grade}</div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 4 }}>{stats.todayWinRate}% win rate</div>
        </BriefingTile>
      )}

      {/* Session Summary */}
      <BriefingTile
        title={stats.todayCount > 0 ? 'SESSION SUMMARY' : 'WEEKLY RECAP'}
        isMobile={isMobile}
        style={{ marginRight: 10, flex: '1 1 200px' }}
      >
        {stats.todayCount > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MiniStat label="P&L" value={fmtD(stats.todayPnl)} color={stats.todayPnl >= 0 ? C.g : C.r} />
            <MiniStat label="Trades" value={stats.todayCount} color={C.t1} />
            <MiniStat label="W/L" value={`${stats.todayWins}/${stats.todayCount - stats.todayWins}`} color={C.t1} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MiniStat label="Week P&L" value={fmtD(stats.weekPnl)} color={stats.weekPnl >= 0 ? C.g : C.r} />
            <MiniStat label="Trades" value={stats.weekCount} color={C.t1} />
          </div>
        )}
      </BriefingTile>

      {/* Best / Worst */}
      {stats.todayBest && stats.todayWorst && stats.todayCount > 1 && (
        <BriefingTile
          title="BEST / WORST"
          isMobile={isMobile}
          style={{ marginRight: 10, flex: '0 0 auto', minWidth: 150 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: C.g, fontWeight: 700, fontFamily: M }}>▲</span>
              <span style={{ fontWeight: 700, color: C.t1, fontFamily: M }}>{stats.todayBest.symbol}</span>
              <span style={{ color: C.g, fontFamily: M }}>{fmtD(stats.todayBest.pnl)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ color: C.r, fontWeight: 700, fontFamily: M }}>▼</span>
              <span style={{ fontWeight: 700, color: C.t1, fontFamily: M }}>{stats.todayWorst.symbol}</span>
              <span style={{ color: C.r, fontFamily: M }}>{fmtD(stats.todayWorst.pnl)}</span>
            </div>
          </div>
        </BriefingTile>
      )}

      {/* Streak */}
      <BriefingTile title="STREAK" isMobile={isMobile} style={{ flex: '0 0 auto', minWidth: 110 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: stats.streakType === 'win' ? C.g : C.r }}>
          {streakText}
        </div>
      </BriefingTile>
    </>
  );
}
