// ═══════════════════════════════════════════════════════════════════
// charEdge — Contextual Widget Injection (Sprint 18)
//
// Auto-injects temporary, context-sensitive banners/cards based on
// trading state: consecutive losses, new records, inactivity, etc.
// Cards are dismissable and auto-expire after their context ends.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useCallback } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

// ─── Context Rule Definitions ────────────────────────────────────

function evaluateContextRules(trades) {
  const rules = [];
  if (!trades || trades.length === 0) return rules;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= today);

  // Sort all trades by date descending
  const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ─── Rule 1: Consecutive Losses ──────────────────────────
  let consecLosses = 0;
  for (const t of sorted) {
    if ((t.pnl || 0) < 0) consecLosses++;
    else break;
  }
  if (consecLosses >= 3) {
    rules.push({
      id: 'consec-losses',
      priority: 90,
      icon: '🧘',
      title: 'Take a Breather',
      body: `You have ${consecLosses} consecutive losses. Step away for 15 minutes, review your rules, and come back with clarity.`,
      color: 'red',
      type: 'warning',
    });
  }

  // ─── Rule 2: New P&L record ──────────────────────────────
  let equity = 0, peak = 0;
  const chronological = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const t of chronological) {
    equity += t.pnl || 0;
    if (equity > peak) peak = equity;
  }
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  if (todayTrades.length > 0 && equity === peak && todayPnl > 0 && peak > 100) {
    rules.push({
      id: 'new-record',
      priority: 80,
      icon: '🎉',
      title: 'New All-Time High!',
      body: `Your equity just hit a new peak of ${fmtD(peak)}. Incredible run — protect these gains!`,
      color: 'green',
      type: 'celebration',
    });
  }

  // ─── Rule 3: Haven't traded in 3+ days ───────────────────
  if (sorted.length > 0) {
    const lastTradeDate = new Date(sorted[0].date);
    const daysSince = Math.floor((today - lastTradeDate) / (1000 * 60 * 60 * 24));
    if (daysSince >= 3) {
      rules.push({
        id: 'welcome-back',
        priority: 70,
        icon: '👋',
        title: 'Welcome Back!',
        body: `It has been ${daysSince} days since your last trade. Here is a quick catch-up: your equity is at ${fmtD(equity)} with ${trades.length} total trades.`,
        color: 'blue',
        type: 'info',
      });
    }
  }

  // ─── Rule 4: First trade of the day ──────────────────────
  if (todayTrades.length === 1) {
    const t = todayTrades[0];
    rules.push({
      id: 'session-started',
      priority: 50,
      icon: '🔔',
      title: 'Session Started!',
      body: `Your first trade today: ${t.symbol || '?'} (${(t.side || 'long').toUpperCase()}) for ${fmtD(t.pnl || 0)}. Stay disciplined!`,
      color: 'blue',
      type: 'info',
    });
  }

  // ─── Rule 5: Overtrading warning ─────────────────────────
  if (todayTrades.length >= 10) {
    rules.push({
      id: 'overtrading',
      priority: 75,
      icon: '⚠️',
      title: 'Overtrading Alert',
      body: `You have taken ${todayTrades.length} trades today. Quality over quantity — are you sticking to your plan?`,
      color: 'yellow',
      type: 'warning',
    });
  }

  return rules.sort((a, b) => b.priority - a.priority);
}

// ─── Component ───────────────────────────────────────────────────

const COLOR_MAP = {
  green: { bg: `${C.g}08`, border: `${C.g}20`, accent: C.g },
  red: { bg: `${C.r}08`, border: `${C.r}20`, accent: C.r },
  yellow: { bg: `${C.y}08`, border: `${C.y}20`, accent: C.y },
  blue: { bg: `${C.b}08`, border: `${C.b}20`, accent: C.b },
};

export default function ContextualInjector() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();
  const [dismissed, setDismissed] = useState(new Set());

  const cards = useMemo(() => {
    return evaluateContextRules(trades).filter((c) => !dismissed.has(c.id));
  }, [trades, dismissed]);

  const handleDismiss = useCallback((id) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  if (cards.length === 0) return null;

  // Show at most 2 context cards
  const visible = cards.slice(0, 2);

  return (
    <div style={{ marginBottom: 14 }}>
      {visible.map((card) => {
        const colors = COLOR_MAP[card.color] || COLOR_MAP.blue;
        return (
          <div
            key={card.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: isMobile ? '10px 14px' : '12px 16px',
              borderRadius: 8,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              marginBottom: 8,
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
              {card.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 2 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 11, color: C.t2, fontFamily: M, lineHeight: 1.5 }}>
                {card.body}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(card.id)}
              className="tf-btn"
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 2px',
                opacity: 0.5,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
