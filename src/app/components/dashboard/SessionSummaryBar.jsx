// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Summary Bar (Apple-Style Condensed)
//
// Replaces the ribbon pills + "Today's Session" header + 3 hero
// cards with a single compact, glanceable bar at the top.
// Inspired by iOS Stocks / Health summary cards.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, GLASS } from '../../../constants.js';
import { text, radii } from '../../../theme/tokens.js';
import { fmtD } from '../../../utils.js';
import { useCountUp } from '@/hooks/useCountUp';
import { useAccountStore } from '@/state/useAccountStore';

// ─── Mini Sparkline (subtle background accent) ─────────────────
function MiniSparkline({ data, color, width = 80, height = 28 }) {
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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ opacity: 0.4 }}
    >
      <defs>
        <linearGradient id="barSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#barSparkFill)" points={`0,${height} ${points} ${width},${height}`} />
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

// ─── Stat Cell ─────────────────────────────────────────────────
function StatCell({ label, value, color, accent }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span
        style={{
          ...text.label,
          fontSize: 9,
          letterSpacing: '0.06em',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono, "SF Mono", "Fira Code", monospace)',
          fontSize: accent ? 15 : 13,
          fontWeight: 700,
          color: color || C.t1,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Vertical Divider ──────────────────────────────────────────
function VDivider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: `${C.bd}50`,
        margin: '4px 0',
        flexShrink: 0,
      }}
    />
  );
}

// ═══ Main Component ═══════════════════════════════════════════════

function SessionSummaryBar({
  todayPnl,
  todayCount,
  winRate,
  yesterdayPnl,
  recentDailyPnl = [],
  ribbonStats,
  isMobile = false,
  collapsed = false,
}) {
  const [expanded, setExpanded] = React.useState(() => localStorage.getItem('tf_summary_expanded') === '1');
  const showExtras = !collapsed || expanded;
  const isDemo = useAccountStore((s) => s.activeAccountId === 'demo');
  const animatedPnl = useCountUp(todayPnl, 600, true);
  const pnlColor = todayPnl >= 0 ? C.g : todayPnl < 0 ? C.r : C.t3;

  // Trend vs yesterday
  let trendEl = null;
  if (yesterdayPnl != null && yesterdayPnl !== 0) {
    const delta = todayPnl - yesterdayPnl;
    const pct = ((delta / Math.abs(yesterdayPnl)) * 100).toFixed(0);
    const isUp = delta >= 0;
    trendEl = (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'var(--font-mono, monospace)',
          color: isUp ? C.g : C.r,
          background: (isUp ? C.g : C.r) + '12',
          padding: '1px 6px',
          borderRadius: radii.xs,
          marginLeft: 6,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isUp ? '↑' : '↓'} {Math.abs(pct)}%
      </span>
    );
  }

  return (
    <div
      className="tf-section-enter"
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 10 : 20,
        padding: isMobile ? '14px 16px' : '14px 22px',
        background: GLASS.subtle,
        backdropFilter: GLASS.blurSm,
        WebkitBackdropFilter: GLASS.blurSm,
        border: `1px solid ${C.bd}60`,
        borderRadius: radii.xl,
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ─── Hero P&L (left) ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ ...text.label, fontSize: 9, lineHeight: 1 }}>Today's P&L</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, "SF Mono", monospace)',
                fontSize: isMobile ? 32 : 28,
                fontWeight: 800,
                color: pnlColor,
                letterSpacing: '-1px',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {fmtD(animatedPnl)}
            </span>
            {trendEl}
          </div>
        </div>

        {/* Sparkline accent */}
        {recentDailyPnl.length > 1 && <MiniSparkline data={recentDailyPnl} color={pnlColor} />}
      </div>

      {!isMobile && <VDivider />}

      {/* ─── Today's stats + period stats ──────────────────── */}
      <div
        style={{
          display: isMobile ? 'grid' : 'flex',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : undefined,
          gap: isMobile ? 10 : 20,
          alignItems: 'center',
          width: isMobile ? '100%' : undefined,
        }}
      >
        <StatCell
          label="Win Rate"
          value={todayCount > 0 ? `${Math.round(winRate)}%` : '—'}
          color={winRate >= 60 ? C.g : winRate >= 40 ? C.y : C.t3}
        />
        <StatCell label="Trades" value={todayCount} />

        {ribbonStats && showExtras && (
          <>
            <StatCell label="Week" value={fmtD(ribbonStats.weekPnl)} color={ribbonStats.weekPnl >= 0 ? C.g : C.r} />
            <StatCell label="Month" value={fmtD(ribbonStats.monthPnl)} color={ribbonStats.monthPnl >= 0 ? C.g : C.r} />
            <StatCell label="Total" value={fmtD(ribbonStats.totalPnl)} color={ribbonStats.totalPnl >= 0 ? C.g : C.r} />
            <StatCell
              label="Streak"
              value={`${ribbonStats.streak}d ${ribbonStats.streakType === 'win' ? '🔥' : '📉'}`}
              color={ribbonStats.streakType === 'win' ? C.g : C.r}
            />
          </>
        )}

        {/* Chevron toggle for collapsed mode */}
        {collapsed && ribbonStats && (
          <button
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              localStorage.setItem('tf_summary_expanded', next ? '1' : '0');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              fontSize: 11,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              flexShrink: 0,
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            title={expanded ? 'Show less' : 'Show more stats'}
          >
            ▾
          </button>
        )}
      </div>

      {/* ─── Demo badge ──────────────────────────────────────── */}
      {isDemo && (
        <div
          style={{
            marginLeft: 'auto',
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #3b82f620, #3b82f610)',
            color: '#3b82f6',
            border: '1px solid #3b82f630',
            borderRadius: 6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          🧪 Demo
        </div>
      )}
    </div>
  );
}

export default React.memo(SessionSummaryBar);
