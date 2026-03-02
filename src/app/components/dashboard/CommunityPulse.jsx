// ═══════════════════════════════════════════════════════════════════
// charEdge — Community Pulse Feed (Sprint 13)
//
// Compact feed showing anonymized community trading stats:
//   - Community average P&L today
//   - Trending strategies
//   - Active trader count
//   - Social proof metrics
// Uses simulated data for now (no backend).
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';


// ─── Simulated community data (seeded by day) ────────────────────

function getCommunityData(userTrades) {
  const today = new Date();
  const seed = today.getDate() + today.getMonth() * 31;

  // Simulated ranges based on seed
  const tradersOnline = 120 + (seed * 7) % 300;
  const avgPnl = ((seed * 13) % 500) - 200;
  const streakTraders = 15 + (seed * 3) % 50;
  const topStrategy = ['Momentum', 'Breakout', 'Reversal', 'Scalping', 'Swing'][seed % 5];
  const sentimentBull = 45 + (seed * 9) % 30;

  // User's percentile (based on actual data)
  const userPnl = userTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const percentile = Math.min(99, Math.max(1, 50 + Math.round(userPnl / 100)));

  return {
    tradersOnline,
    avgPnl,
    streakTraders,
    topStrategy,
    sentimentBull,
    percentile,
  };
}

// ─── Component ───────────────────────────────────────────────────

export default function CommunityPulse() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();
  const [optedIn, setOptedIn] = useState(() => {
    try { return localStorage.getItem('tf-community-optin') === 'true'; } catch { return false; }
  });

  const data = useMemo(() => getCommunityData(trades || []), [trades]);



  if (!optedIn) {
    return (
      <div style={{
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>🌐</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1 }}>
                Community Pulse
              </div>
              <div style={{ fontSize: 10, fontFamily: M, color: C.t3, marginTop: 1 }}>
                See how you compare to other traders
              </div>
            </div>
          </div>
          <button
            className="tf-btn"
            onClick={() => {
              setOptedIn(true);
              try { localStorage.setItem('tf-community-optin', 'true'); } catch {}
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${C.b}30`,
              background: C.b + '12',
              color: C.b,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            Enable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: isMobile ? '12px 14px' : '14px 18px',
      borderRadius: 10,
      background: C.sf,
      border: `1px solid ${C.bd}`,
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, lineHeight: 1 }}>🌐</span>
          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Community Pulse
          </span>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.g, boxShadow: `0 0 4px ${C.g}60`,
          }} />
          <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
            {data.tradersOnline} online
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {/* Avg Community P&L */}
        <div style={{ padding: '8px 10px', borderRadius: 6, background: C.bg2 + '60' }}>
          <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
            Avg P&L Today
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: data.avgPnl >= 0 ? C.g : C.r }}>
            {fmtD(data.avgPnl)}
          </div>
        </div>

        {/* Top Strategy */}
        <div style={{ padding: '8px 10px', borderRadius: 6, background: C.bg2 + '60' }}>
          <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
            Top Strategy
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: C.b }}>
            {data.topStrategy}
          </div>
        </div>

        {/* Sentiment */}
        <div style={{ padding: '8px 10px', borderRadius: 6, background: C.bg2 + '60' }}>
          <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
            Sentiment
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: C.g }}>
              {data.sentimentBull}%
            </span>
            <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
              bullish
            </span>
          </div>
        </div>

        {/* Your Percentile */}
        <div style={{ padding: '8px 10px', borderRadius: 6, background: C.bg2 + '60' }}>
          <div style={{ fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, letterSpacing: '0.04em', marginBottom: 4, textTransform: 'uppercase' }}>
            Your Rank
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: data.percentile >= 50 ? C.g : C.r }}>
            Top {100 - data.percentile}%
          </div>
        </div>
      </div>

      {/* Streak social proof */}
      <div style={{
        marginTop: 8,
        padding: '5px 10px',
        borderRadius: 4,
        background: C.b + '06',
        fontSize: 10,
        fontFamily: M,
        color: C.t2,
        textAlign: 'center',
      }}>
        🔥 {data.streakTraders} traders are on a 5+ day streak right now
      </div>
    </div>
  );
}
