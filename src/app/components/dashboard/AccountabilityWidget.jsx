// ═══════════════════════════════════════════════════════════════════
// charEdge — Accountability Widget (Sprint 15)
//
// Self-accountability system with daily goal tracking and
// AI-powered accountability partner. Users set daily goals,
// check in at end of session, and track adherence over time.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import React, { useState, useMemo, useCallback } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountabilityWidget() {
  const trades = useJournalStore((s) => s.trades);
  const dailyLossLimit = useUserStore((s) => s.dailyLossLimit) || 0;
  const { isMobile } = useBreakpoints();

  // Daily check-in state (persisted in localStorage)
  const [checkin, setCheckin] = useState(() => {
    try {
      const saved = localStorage.getItem('tf-accountability-' + getTodayKey());
      return saved ? JSON.parse(saved) : { followedRules: null, rating: null, note: '' };
    } catch { return { followedRules: null, rating: null, note: '' }; }
  });

  // Today's performance snapshot
  const snapshot = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = (trades || []).filter((t) => t.date && new Date(t.date) >= today);
    const pnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0;
    const ruleBreaks = todayTrades.filter((t) => t.ruleBreak).length;
    return { pnl, count: todayTrades.length, winRate, ruleBreaks };
  }, [trades]);

  // AI accountability coaching based on today's data
  const coachMessage = useMemo(() => {
    if (snapshot.count === 0) return "You haven't traded yet today. When you do, I'll be here to check in.";
    if (snapshot.ruleBreaks > 0) return `⚠️ ${snapshot.ruleBreaks} rule break${snapshot.ruleBreaks > 1 ? 's' : ''} today. Reflect: what triggered them?`;
    if (snapshot.pnl < 0 && dailyLossLimit > 0 && Math.abs(snapshot.pnl) > dailyLossLimit * 0.7) return "You're approaching your daily loss limit. Consider pausing to protect capital.";
    if (snapshot.winRate >= 60) return `Strong execution today — ${snapshot.winRate}% win rate across ${snapshot.count} trades. Keep it up!`;
    if (snapshot.pnl > 0) return 'Green day so far. Are you trading your plan, or getting lucky?';
    return 'How was your discipline today? Rate your session honestly.';
  }, [snapshot, dailyLossLimit]);

  const saveCheckin = useCallback((updates) => {
    const next = { ...checkin, ...updates };
    setCheckin(next);
    try {
      localStorage.setItem('tf-accountability-' + getTodayKey(), JSON.stringify(next));
    } catch {}
  }, [checkin]);

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
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>🤝</span>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: M,
          color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Accountability Partner
        </span>
      </div>

      {/* AI Coach message */}
      <div style={{
        padding: '8px 12px',
        borderRadius: 6,
        background: C.b + '08',
        border: `1px solid ${C.b}15`,
        marginBottom: 10,
        fontSize: 11,
        fontFamily: M,
        color: C.t2,
        lineHeight: 1.5,
      }}>
        {coachMessage}
      </div>

      {/* Daily check-in */}
      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: M, color: C.t3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Session Check-In
      </div>

      {/* Did you follow rules? */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, fontFamily: M, color: C.t2 }}>
          Did you follow your rules?
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Yes', 'Mostly', 'No'].map((opt) => (
            <button
              key={opt}
              className="tf-btn"
              onClick={() => saveCheckin({ followedRules: opt })}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${checkin.followedRules === opt ? C.b : C.bd}`,
                background: checkin.followedRules === opt ? C.b + '15' : 'transparent',
                color: checkin.followedRules === opt ? C.b : C.t3,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: M,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Session rating */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, fontFamily: M, color: C.t2 }}>
          Rate your discipline
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="tf-btn"
              onClick={() => saveCheckin({ rating: n })}
              style={{
                width: 24, height: 24,
                borderRadius: 4,
                border: `1px solid ${checkin.rating === n ? C.b : C.bd}`,
                background: checkin.rating === n ? C.b + '15' : 'transparent',
                color: checkin.rating === n ? C.b : C.t3,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: M,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Complete state */}
      {checkin.followedRules && checkin.rating && (
        <div style={{
          padding: '6px 10px',
          borderRadius: 4,
          background: C.g + '08',
          fontSize: 10,
          fontFamily: M,
          color: C.g,
          textAlign: 'center',
          marginTop: 4,
        }}>
          ✓ Check-in complete! Your honest reflection builds better habits.
        </div>
      )}
    </div>
  );
}
