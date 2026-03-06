// ═══════════════════════════════════════════════════════════════════
// charEdge — Natural Language Query Bar (Sprint 19)
//
// Ask your data anything: "What was my best day this month?"
// Parses intent using template matching and renders inline answers.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { C, M, F } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { fmtD } from '../../../utils.js';

// ─── Query Parser ────────────────────────────────────────────────

function parseAndAnswer(query, trades) {
  const q = query.toLowerCase().trim();
  if (!trades || trades.length === 0) return { type: 'empty', text: 'No trades to analyze yet.' };

  // ─── Best day ──────────────────────────────────────────────
  if (q.includes('best day') || q.includes('most profitable day')) {
    const byDay = {};
    trades.forEach((t) => {
      const day = new Date(t.date).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (t.pnl || 0);
    });
    const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      return {
        type: 'answer',
        icon: '📅',
        text: `Your best day was **${best[0]}** with ${fmtD(best[1])} in profits.`,
      };
    }
  }

  // ─── Worst day ─────────────────────────────────────────────
  if (q.includes('worst day') || q.includes('biggest loss day')) {
    const byDay = {};
    trades.forEach((t) => {
      const day = new Date(t.date).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (t.pnl || 0);
    });
    const worst = Object.entries(byDay).sort((a, b) => a[1] - b[1])[0];
    if (worst) {
      return {
        type: 'answer',
        icon: '📉',
        text: `Your worst day was **${worst[0]}** at ${fmtD(worst[1])}.`,
      };
    }
  }

  // ─── Win rate ──────────────────────────────────────────────
  if (q.includes('win rate') || q.includes('winrate')) {
    const dayMatch = q.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?/);
    let subset = trades;
    let label = 'overall';
    if (dayMatch) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayIdx = dayNames.indexOf(dayMatch[1]);
      subset = trades.filter((t) => new Date(t.date).getDay() === dayIdx);
      label = `on ${dayMatch[1]}s`;
    }
    const wins = subset.filter((t) => (t.pnl || 0) > 0).length;
    const rate = subset.length > 0 ? Math.round((wins / subset.length) * 100) : 0;
    return {
      type: 'answer',
      icon: '🎯',
      text: `Your win rate ${label} is **${rate}%** (${wins} wins out of ${subset.length} trades).`,
    };
  }

  // ─── Best/worst symbol ─────────────────────────────────────
  if (q.includes('best symbol') || q.includes('most profitable symbol')) {
    const bySymbol = {};
    trades.forEach((t) => {
      const s = (t.symbol || 'Unknown').toUpperCase();
      bySymbol[s] = (bySymbol[s] || 0) + (t.pnl || 0);
    });
    const best = Object.entries(bySymbol).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      return {
        type: 'answer',
        icon: '🏆',
        text: `Your most profitable symbol is **${best[0]}** at ${fmtD(best[1])} total P&L.`,
      };
    }
  }

  // ─── Total P&L ─────────────────────────────────────────────
  if (q.includes('total p') || q.includes('total profit') || q.includes('how much')) {
    const total = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    return {
      type: 'answer',
      icon: '💰',
      text: `Your total P&L across ${trades.length} trades is **${fmtD(total)}**.`,
    };
  }

  // ─── Longest streak ────────────────────────────────────────
  if (q.includes('streak') || q.includes('consecutive wins')) {
    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    let maxStreak = 0, current = 0;
    for (const t of sorted) {
      if ((t.pnl || 0) > 0) { current++; maxStreak = Math.max(maxStreak, current); }
      else current = 0;
    }
    return {
      type: 'answer',
      icon: '🔥',
      text: `Your longest winning streak was **${maxStreak} trades** in a row.`,
    };
  }

  // ─── How many trades ───────────────────────────────────────
  if (q.includes('how many trades') || q.includes('trade count') || q.includes('total trades')) {
    const symbolMatch = q.match(/on\s+(\w+)/);
    if (symbolMatch) {
      const sym = symbolMatch[1].toUpperCase();
      const count = trades.filter((t) => (t.symbol || '').toUpperCase() === sym).length;
      return {
        type: 'answer',
        icon: '📊',
        text: `You have logged **${count}** trades on ${sym}.`,
      };
    }
    return {
      type: 'answer',
      icon: '📊',
      text: `You have logged a total of **${trades.length}** trades.`,
    };
  }

  // ─── Average ───────────────────────────────────────────────
  if (q.includes('average') || q.includes('avg')) {
    const avg = trades.reduce((s, t) => s + (t.pnl || 0), 0) / trades.length;
    return {
      type: 'answer',
      icon: '📐',
      text: `Your average P&L per trade is **${fmtD(avg)}**.`,
    };
  }

  // ─── Long vs short ─────────────────────────────────────────
  if (q.includes('long vs short') || q.includes('long or short') || q.includes('side')) {
    const longs = trades.filter((t) => (t.side || '').toLowerCase() === 'long');
    const shorts = trades.filter((t) => (t.side || '').toLowerCase() === 'short');
    const longPnl = longs.reduce((s, t) => s + (t.pnl || 0), 0);
    const shortPnl = shorts.reduce((s, t) => s + (t.pnl || 0), 0);
    return {
      type: 'answer',
      icon: '⚖️',
      text: `**Long** (${longs.length} trades): ${fmtD(longPnl)} | **Short** (${shorts.length} trades): ${fmtD(shortPnl)}. ${longPnl > shortPnl ? 'Long bias is stronger.' : 'Short bias is stronger.'}`,
    };
  }

  // ─── No match ──────────────────────────────────────────────
  return {
    type: 'suggestions',
    text: 'Try asking:',
    suggestions: [
      'What was my best day?',
      'What is my win rate on Mondays?',
      'Total P&L this month?',
      'Best symbol?',
      'Longest winning streak?',
      'Long vs short performance?',
    ],
  };
}

// ─── Component ───────────────────────────────────────────────────

export default function NLQueryBar() {
  const trades = useJournalStore((s) => s.trades);
  const { isMobile } = useBreakpoints();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (query.trim().length < 3) return;
    setResult(parseAndAnswer(query, trades));
  }, [query, trades]);

  const handleSuggestion = useCallback((s) => {
    setQuery(s);
    setResult(parseAndAnswer(s, trades));
  }, [trades]);

  return (
    <div className="tf-container tf-nl-query"
      style={{
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${focused ? C.b + '40' : C.bd}`,
        marginBottom: 14,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Search input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 12px' : '10px 16px' }}>
        <span style={{ fontSize: 14, flexShrink: 0, opacity: 0.6 }}>🔮</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask your data anything..."
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: C.t1,
            fontSize: 12,
            fontFamily: M,
            outline: 'none',
            padding: 0,
          }}
        />
        {query.length > 0 && (
          <button
            type="submit"
            className="tf-btn"
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: `1px solid ${C.b}30`,
              background: C.b + '12',
              color: C.b,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            Ask
          </button>
        )}
      </form>

      {/* Result */}
      {result && (
        <div style={{
          padding: isMobile ? '8px 12px 12px' : '8px 16px 14px',
          borderTop: `1px solid ${C.bd}50`,
        }}>
          {result.type === 'answer' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                {result.icon}
              </span>
              <div
                style={{ fontSize: 12, color: C.t1, fontFamily: M, lineHeight: 1.5 }}
              >
                {result.text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                  i % 2 === 1
                    ? <strong key={i} style={{ color: C.b }}>{part}</strong>
                    : part
                )}
              </div>
            </div>
          )}
          {result.type === 'suggestions' && (
            <div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 6 }}>
                {result.text}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {result.suggestions.map((s) => (
                  <button
                    key={s}
                    className="tf-btn"
                    onClick={() => handleSuggestion(s)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: `1px solid ${C.bd}`,
                      background: C.bg2,
                      color: C.t2,
                      fontSize: 10,
                      fontFamily: M,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {result.type === 'empty' && (
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              {result.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
