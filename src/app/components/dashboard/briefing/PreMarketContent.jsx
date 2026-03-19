// ═══════════════════════════════════════════════════════════════════
// Morning Briefing — Pre-Market Content
// Yesterday recap, trade plans, risk budget, streak.
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '@/constants.js';
import { fmtD } from '../../../../utils.js';
import { BriefingTile } from './BriefingPrimitives.jsx';

export default function PreMarketContent({ stats, plans, dailyLossLimit, isMobile, streakText }) {
    return (
        <>
            {/* Yesterday Recap */}
            {stats.yestCount > 0 && (
                <BriefingTile title="YESTERDAY" isMobile={isMobile} style={{ marginRight: 10, flex: '1 1 180px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: stats.yestPnl >= 0 ? C.g : C.r }}>
                            {fmtD(stats.yestPnl)}
                        </span>
                        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                            {stats.yestCount} trades · {stats.yestWinRate}% WR
                        </span>
                    </div>
                    {stats.yestBest && (
                        <div style={{ fontSize: 10, color: C.t2, fontFamily: M, marginTop: 4 }}>
                            Best: {stats.yestBest.symbol} {fmtD(stats.yestBest.pnl || 0)}
                        </div>
                    )}
                </BriefingTile>
            )}

            {/* Active Trade Plans */}
            {plans.length > 0 && (
                <BriefingTile title="TODAY'S PLANS" isMobile={isMobile} style={{ marginRight: 10, flex: '1 1 180px' }}>
                    {plans.map((p) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                background: (p.bias === 'long' ? C.g : p.bias === 'short' ? C.r : C.b) + '20',
                                color: p.bias === 'long' ? C.g : p.bias === 'short' ? C.r : C.b,
                            }}>
                                {(p.bias || 'N').charAt(0).toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: C.t1 }}>{p.symbol}</span>
                            <span style={{ fontSize: 10, color: C.t3, fontFamily: M, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                {p.entryReason || 'No criteria set'}
                            </span>
                        </div>
                    ))}
                </BriefingTile>
            )}

            {/* Risk Budget */}
            {dailyLossLimit > 0 && (
                <BriefingTile title="RISK BUDGET" isMobile={isMobile} style={{ flex: '0 0 auto', minWidth: 120 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: M, color: C.g }}>{fmtD(dailyLossLimit)}</div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>Daily loss limit available</div>
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
