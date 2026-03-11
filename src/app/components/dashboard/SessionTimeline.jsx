// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Timeline Ribbon (Sprint 7)
//
// Visual timeline showing the trading day lifecycle with markers
// for each trade, session boundaries, and current position.
// Provides at-a-glance understanding of when trades were executed.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { radii } from '../../../theme/tokens.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// ─── Session Boundaries ──────────────────────────────────────────

const SESSION_MARKERS = [
  { hour: 4, label: 'Pre-Market Open', color: 'b' },
  { hour: 9.5, label: 'Market Open', color: 'g' },
  { hour: 12, label: 'Lunch', color: 't3' },
  { hour: 16, label: 'Market Close', color: 'r' },
  { hour: 20, label: 'After-Hours End', color: 'p' },
];

const TIMELINE_START = 4; // 4am
const TIMELINE_END = 21;  // 9pm
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;

function hourToPercent(decimalHour) {
  return Math.max(0, Math.min(100, ((decimalHour - TIMELINE_START) / TIMELINE_RANGE) * 100));
}

// ─── Component ───────────────────────────────────────────────────

export default function SessionTimeline() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();

  // Today's trades with timestamps
  const todayTrades = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return trades
      .filter((t) => t.date && new Date(t.date) >= today)
      .map((t) => {
        const d = new Date(t.date);
        const decimalHour = d.getHours() + d.getMinutes() / 60;
        return { ...t, decimalHour, position: hourToPercent(decimalHour) };
      })
      .sort((a, b) => a.decimalHour - b.decimalHour);
  }, [trades]);

  // Current time position
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const currentPos = hourToPercent(currentHour);
  const isWithinTimeline = currentHour >= TIMELINE_START && currentHour <= TIMELINE_END;

  // Skip rendering if outside timeline hours or no relevance
  if (currentHour < 3 || currentHour > 22) return null;

  return (
    <div className="tf-container tf-session-timeline"
      style={{
        padding: isMobile ? '10px 14px' : '12px 18px',
        borderRadius: radii.md,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        marginBottom: 14,
      }}
    >
      {/* Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Session Timeline
        </span>
        {todayTrades.length > 0 && (
          <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
            {todayTrades.length} trade{todayTrades.length !== 1 ? 's' : ''} today
          </span>
        )}
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 28 }}>
        {/* Background track */}
        <div style={{
          position: 'absolute',
          top: 11,
          left: 0,
          right: 0,
          height: 6,
          borderRadius: 3,
          background: C.bg2,
          overflow: 'hidden',
        }}>
          {/* Active session highlight */}
          <div style={{
            position: 'absolute',
            left: `${hourToPercent(9.5)}%`,
            width: `${hourToPercent(16) - hourToPercent(9.5)}%`,
            height: '100%',
            background: C.g + '15',
          }} />
        </div>

        {/* Session boundary markers */}
        {SESSION_MARKERS.map((m) => {
          const pos = hourToPercent(m.hour);
          return (
            <div
              key={m.hour}
              style={{
                position: 'absolute',
                left: `${pos}%`,
                top: 8,
                width: 1,
                height: 12,
                background: C[m.color] + '40',
                zIndex: 1,
              }}
              title={m.label}
            />
          );
        })}

        {/* Trade markers */}
        {todayTrades.map((t, i) => (
          <div
            key={t.id || i}
            style={{
              position: 'absolute',
              left: `${t.position}%`,
              top: 8,
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              background: (t.pnl || 0) >= 0 ? C.g : C.r,
              border: `2px solid ${C.sf}`,
              transform: 'translate(-4px, 2px)',
              zIndex: 3,
              cursor: 'pointer',
            }}
            title={`${t.symbol || '?'} ${(t.pnl || 0) >= 0 ? '+' : ''}$${Math.abs(t.pnl || 0).toFixed(2)}`}
          />
        ))}

        {/* Current time indicator */}
        {isWithinTimeline && (
          <>
            <div
              className="tf-pulse-dot"
              style={{
                position: 'absolute',
                left: `${currentPos}%`,
                top: 5,
                width: 4,
                height: 18,
                background: C.b,
                borderRadius: 2,
                transform: 'translateX(-2px)',
                zIndex: 4,
                boxShadow: `0 0 8px ${C.b}60`,
              }}
            />
          </>
        )}
      </div>

      {/* Hour labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 4,
      }}>
        {[4, 6, 8, 9.5, 12, 14, 16, 18, 20].map((h) => {
          const label = h === 9.5 ? '9:30' : `${h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}`;
          return (
            <span
              key={h}
              style={{
                fontSize: 8,
                fontFamily: M,
                color: h === 9.5 || h === 16 ? C.t2 : C.t3 + '80',
                fontWeight: h === 9.5 || h === 16 ? 700 : 400,
                position: 'absolute',
                left: `${hourToPercent(h)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
