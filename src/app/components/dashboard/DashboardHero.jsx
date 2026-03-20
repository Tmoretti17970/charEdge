// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Hero Stats (Narrative Redesign)
//
// Sprint 22: Migrated from inline styles → CSS Modules + tokens.
// Dynamic color via --hero-color CSS var; states via data-* attrs.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef } from 'react';
import { C } from '../../../constants.js';
import { gradient } from '../../../theme/tokens.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { useCountUp } from '@/hooks/useCountUp';
import { useAccountStore } from '@/state/useAccountStore';
import s from './DashboardHero.module.css';

// ─── Mini Sparkline (inline SVG) ────────────────────────────────
function MiniSparkline({ data, color, width = 120, height = 32 }) {
  const validData = data.filter((d) => typeof d === 'number' && !isNaN(d));
  if (validData.length < 2) return null;

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const points = validData
    .map((d, i) => {
      const x = (i / (validData.length - 1)) * width;
      const y = height - ((d - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={s.sparklineSvg}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sparkFill)" points={`0,${height} ${points} ${width},${height}`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ─── Trend Arrow ────────────────────────────────────────────────
function TrendArrow({ current, previous }) {
  if (previous == null || previous === 0) return null;
  const delta = current - previous;
  const pct = ((delta / Math.abs(previous)) * 100).toFixed(0);
  const isUp = delta >= 0;

  return (
    <span className={`tf-hero-trend ${s.trend}`} data-dir={isUp ? 'up' : 'down'}>
      {isUp ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

function DashboardHero({ todayPnl, todayCount, winRate, yesterdayPnl, recentDailyPnl = [], isMobile = false }) {
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
  );
  const prefersReducedMotion = reducedMotionRef.current;
  const shouldAnimate = !prefersReducedMotion;

  // Animated hero stat values (count from 0 → target)
  const animatedPnl = useCountUp(todayPnl, 600, shouldAnimate);
  const animatedWinRate = useCountUp(winRate, 600, shouldAnimate);
  const animatedCount = useCountUp(todayCount, 400, shouldAnimate);

  const pnlColor = todayPnl >= 0 ? C.g : todayPnl < 0 ? C.r : C.t3;
  const heroGradient = todayPnl >= 0 ? gradient.heroPositive : gradient.heroNegative;

  const isDemo = useAccountStore((s) => s.activeAccountId === 'demo');

  // Win rate color tier
  const wrTier = winRate >= 60 ? 'good' : winRate >= 40 ? 'mid' : 'low';

  return (
    <div className={`tf-section-enter ${s.grid}`} data-mobile={isMobile}>
      {/* DEMO MODE badge */}
      {isDemo && <div className={s.demoBadge}>🧪 Demo Mode</div>}

      {/* ─── Hero P&L Tile ───────────────────────────────────── */}
      <Card
        className={`${s.pnlTile} ${todayPnl >= 0 ? 'tf-glow-positive' : todayPnl < 0 ? 'tf-glow-negative' : ''}`}
        style={{ '--hero-color': pnlColor, '--hero-gradient': heroGradient }}
      >
        {/* Label row */}
        <div className={s.labelRow}>
          <span className={s.label}>Today's P&L</span>
          <TrendArrow current={todayPnl} previous={yesterdayPnl} />
        </div>

        {/* Big number */}
        <div className={s.bigNumber}>
          {fmtD(animatedPnl)}
        </div>

        {/* Sparkline (last 7 days) */}
        {recentDailyPnl.length > 1 && (
          <div className={s.sparklineWrap}>
            <MiniSparkline data={recentDailyPnl} color={pnlColor} />
          </div>
        )}

        {/* Background orb */}
        <div className={`tf-hero-orb ${s.orb}`} />
      </Card>

      {/* ─── Win Rate ────────────────────────────────────────── */}
      <Card className={s.statTile}>
        <div className={s.statLabel}>Win Rate</div>
        <div className={s.statValue} data-wr={wrTier}>
          {todayCount > 0 ? `${Math.round(animatedWinRate)}%` : '—'}
        </div>
        {todayCount > 0 && (
          <div className={s.statCaption}>
            {Math.round(winRate)}% of {todayCount} trades
          </div>
        )}
      </Card>

      {/* ─── Trade Count ─────────────────────────────────────── */}
      <Card className={s.statTile}>
        <div className={s.statLabel}>Trades</div>
        <div className={s.statValue}>
          {animatedCount < 1 && todayCount > 0 ? 1 : Math.round(animatedCount)}
        </div>
        <div className={s.statCaption}>today's session</div>
      </Card>
    </div>
  );
}

export default React.memo(DashboardHero);
