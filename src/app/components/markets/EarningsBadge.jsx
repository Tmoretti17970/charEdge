// ═══════════════════════════════════════════════════════════════════
// charEdge — Earnings Badge (Sprint 33)
//
// Compact 📅 badge rendered next to symbol name when earnings
// are within 7 days. Tooltip shows date, time, estimates.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, memo } from 'react';
import { C } from '../../../constants.js';
import { fetchEarnings, fmtRevenue } from '../../../services/EarningsService.js';
import { radii, transition } from '../../../theme/tokens.js';

function EarningsBadge({ symbol }) {
  const [earnings, setEarnings] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEarnings(symbol).then((data) => {
      if (!cancelled && data) {
        const earningsDate = new Date(data.nextDate).getTime();
        const daysAway = Math.ceil((earningsDate - Date.now()) / 86400_000);
        if (daysAway <= 7 && daysAway >= 0) {
          setEarnings({ ...data, daysAway });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!earnings) return null;

  const last = earnings.lastReported;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'var(--tf-mono)',
          padding: '1px 5px',
          borderRadius: 4,
          background: C.y + '20',
          color: C.y,
          cursor: 'help',
          transition: transition.fast,
        }}
      >
        📅 {earnings.daysAway === 0 ? 'Today' : `${earnings.daysAway}d`}
      </span>

      {/* Tooltip */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            width: 220,
            padding: '10px 12px',
            borderRadius: radii.md,
            background: C.bg,
            border: `1px solid ${C.bd}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 9999,
            fontFamily: 'var(--tf-font)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
            📅 Earnings — {earnings.symbol}
          </div>

          <div style={{ fontSize: 10, color: C.t2, marginBottom: 3 }}>
            <b>Date:</b> {earnings.nextDate} ({earnings.time})
          </div>
          <div style={{ fontSize: 10, color: C.t2, marginBottom: 3 }}>
            <b>EPS Est:</b> ${earnings.epsEstimate?.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: C.t2, marginBottom: 6 }}>
            <b>Rev Est:</b> {fmtRevenue(earnings.revenueEstimate)}
          </div>

          {last && (
            <div
              style={{
                padding: '6px 8px',
                borderRadius: radii.sm,
                background: C.bg2,
                fontSize: 10,
                color: C.t3,
              }}
            >
              <div style={{ fontWeight: 700, color: C.t2, marginBottom: 3 }}>Last: {last.date}</div>
              <div>
                EPS: ${last.epsActual?.toFixed(2)} vs ${last.epsEstimate?.toFixed(2)}
                <span
                  style={{
                    marginLeft: 5,
                    fontWeight: 700,
                    color: last.beat ? C.g : C.r,
                  }}
                >
                  {last.beat ? '✅ Beat' : '❌ Miss'} ({last.surprise > 0 ? '+' : ''}
                  {last.surprise?.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

export default memo(EarningsBadge);
