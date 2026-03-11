// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Hero Stats (Narrative Redesign)
//
// Rich hero section with:
//  - Trend indicator (↑/↓ vs yesterday)
//  - 7-day P&L sparkline in the hero tile
//  - Animated counters
//  - Responsive layout
// ═══════════════════════════════════════════════════════════════════

import { C, GLASS } from '../../../constants.js';
import { gradient, text, radii } from '../../../theme/tokens.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { useCountUp } from '@/hooks/useCountUp';

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
      style={{ opacity: 0.5, marginTop: 'auto' }}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#sparkFill)"
        points={`0,${height} ${points} ${width},${height}`}
      />
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
    <span
      className="tf-hero-trend"
      style={{
        ...text.monoXs,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: isUp ? C.g : C.r,
        background: (isUp ? C.g : C.r) + '12',
        padding: '2px 7px',
        borderRadius: radii.xs,
        marginLeft: 6,
      }}
    >
      {isUp ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

export default function DashboardHero({
  todayPnl,
  todayCount,
  winRate,
  yesterdayPnl,
  recentDailyPnl = [],
  isMobile = false,
}) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const shouldAnimate = !prefersReducedMotion;

  // Animated hero stat values (count from 0 → target)
  const animatedPnl = useCountUp(todayPnl, 600, shouldAnimate);
  const animatedWinRate = useCountUp(winRate, 600, shouldAnimate);
  const animatedCount = useCountUp(todayCount, 400, shouldAnimate);

  const pnlColor = todayPnl >= 0 ? C.g : todayPnl < 0 ? C.r : C.t3;
  const heroGradient = todayPnl >= 0 ? gradient.heroPositive : gradient.heroNegative;

  return (
    <div
      className="tf-section-enter"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : 'minmax(240px, 1.8fr) minmax(120px, 1fr) minmax(120px, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {/* ─── Hero P&L Tile ───────────────────────────────────── */}
      <Card
        className={todayPnl >= 0 ? 'tf-glow-positive' : todayPnl < 0 ? 'tf-glow-negative' : ''}
        style={{
          padding: '20px 22px 12px',
          background: heroGradient,
          border: `1px solid ${pnlColor}20`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Label row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span
            style={{ ...text.label }}
          >
            Today's P&L
          </span>
          <TrendArrow current={todayPnl} previous={yesterdayPnl} />
        </div>

        {/* Big number */}
        <div
          style={{
            ...text.dataHero,
            fontSize: 42,
            fontWeight: 800,
            color: pnlColor,
            letterSpacing: '-1.5px',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${pnlColor}35, 0 0 80px ${pnlColor}15`,
            zIndex: 1,
          }}
        >
          {fmtD(animatedPnl)}
        </div>

        {/* Sparkline (last 7 days) */}
        {recentDailyPnl.length > 1 && (
          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            <MiniSparkline data={recentDailyPnl} color={pnlColor} />
          </div>
        )}

        {/* Background orb */}
        <div
          className="tf-hero-orb"
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: `radial-gradient(circle, ${pnlColor}18, transparent 70%)`,
            borderRadius: radii.pill,
            pointerEvents: 'none',
          }}
        />
      </Card>

      {/* ─── Win Rate ────────────────────────────────────────── */}
      <Card
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: GLASS.subtle,
          backdropFilter: GLASS.blurSm,
          WebkitBackdropFilter: GLASS.blurSm,
        }}
      >
        <div
          style={{
            ...text.label,
            marginBottom: 6,
          }}
        >
          Win Rate
        </div>
        <div
          style={{
            ...text.dataLg,
            fontSize: 26,
            fontWeight: 800,
            color: winRate >= 60 ? C.g : winRate >= 40 ? C.y : C.t3,
            lineHeight: 1.1,
          }}
        >
          {todayCount > 0 ? `${Math.round(animatedWinRate)}%` : '—'}
        </div>
        {todayCount > 0 && (
          <div style={{ ...text.captionSm, marginTop: 4 }}>
            {Math.round(winRate)}% of {todayCount} trades
          </div>
        )}
      </Card>

      {/* ─── Trade Count ─────────────────────────────────────── */}
      <Card
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: GLASS.subtle,
          backdropFilter: GLASS.blurSm,
          WebkitBackdropFilter: GLASS.blurSm,
        }}
      >
        <div
          style={{
            ...text.label,
            marginBottom: 6,
          }}
        >
          Trades
        </div>
        <div
          style={{
            ...text.dataLg,
            fontSize: 26,
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          {animatedCount < 1 && todayCount > 0 ? 1 : Math.round(animatedCount)}
        </div>
        <div style={{ ...text.captionSm, marginTop: 4 }}>
          today's session
        </div>
      </Card>
    </div>
  );
}
