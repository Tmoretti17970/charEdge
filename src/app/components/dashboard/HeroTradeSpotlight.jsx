// ═══════════════════════════════════════════════════════════════════
// charEdge — Hero Trade Spotlight (Sprint 9)
//
// Highlights today's best trade with a prominent visual card.
// Shows symbol, P&L, side, strategy, and a brief "what made it work"
// section derived from trade metadata.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { radii } from '../../../theme/tokens.js';
import { fmtD } from '../../../utils.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function HeroTradeSpotlight() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();

  const hero = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= today);
    if (todayTrades.length === 0) {
      // Fallback: show best trade from this week
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekTrades = trades.filter((t) => t.date && new Date(t.date) >= weekStart);
      if (weekTrades.length === 0) return null;

      const best = weekTrades.reduce((b, t) => ((t.pnl || 0) > (b.pnl || 0) ? t : b), weekTrades[0]);
      if ((best.pnl || 0) <= 0) return null;
      return { ...best, period: 'This Week' };
    }

    const best = todayTrades.reduce((b, t) => ((t.pnl || 0) > (b.pnl || 0) ? t : b), todayTrades[0]);
    if ((best.pnl || 0) <= 0) return null;
    return { ...best, period: 'Today' };
  }, [trades]);

  if (!hero) return null;

  const sideColor = (hero.side || '').toLowerCase() === 'long' ? C.g : C.r;
  const sideLabel = (hero.side || '').toUpperCase() || '—';

  return (
    <div className="tf-container tf-hero-trade"
      style={{
        padding: isMobile ? '14px 16px' : '16px 20px',
        borderRadius: radii.md,
        background: `linear-gradient(135deg, ${C.g}08, ${C.b}06)`,
        border: `1px solid ${C.g}20`,
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>🏆</span>
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {hero.period}'s Best Trade
        </span>
      </div>

      {/* Trade details */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 12 : 20,
        flexWrap: 'wrap',
      }}>
        {/* Symbol + Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: radii.xs,
            background: sideColor + '15',
            color: sideColor,
            fontFamily: M,
          }}>
            {sideLabel}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
            {hero.symbol || '—'}
          </span>
        </div>

        {/* P&L */}
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: M, color: C.g, letterSpacing: '-0.5px' }}>
          {fmtD(hero.pnl || 0)}
        </div>

        {/* Strategy */}
        {hero.strategy && (
          <div style={{
            padding: '3px 8px',
            borderRadius: radii.xs,
            background: C.b + '12',
            border: `1px solid ${C.b}20`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: M, color: C.b }}>
              {hero.strategy}
            </span>
          </div>
        )}

        {/* Notes preview */}
        {hero.notes && (
          <div style={{
            fontSize: 11,
            color: C.t2,
            fontFamily: M,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 250,
            fontStyle: 'italic',
          }}>
            "{hero.notes}"
          </div>
        )}
      </div>
    </div>
  );
}
