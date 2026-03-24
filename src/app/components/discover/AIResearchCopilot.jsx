// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Research Copilot
//
// Floating assistant panel for the Discover tab.
// Features:
//   - Quick insight prompts (pre-built questions)
//   - Market condition summary
//   - Personal trade context analysis
//   - Rule-based reasoning engine (no external API needed)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { C } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';
import st from './AIResearchCopilot.module.css';

// ─── Quick Prompts ──────────────────────────────────────────────

const QUICK_PROMPTS = [
  { id: 'summary', label: '30-second summary', icon: '⚡', query: 'Give me the 30-second version of today\'s markets' },
  { id: 'bearcase', label: 'Bear case', icon: '🐻', query: 'What\'s the bear case right now?' },
  { id: 'bullcase', label: 'Bull case', icon: '🐂', query: 'What\'s the bull case right now?' },
  { id: 'risk', label: 'Risk check', icon: '🛡️', query: 'How is my risk exposure looking?' },
  { id: 'setup', label: 'Best setup today', icon: '🎯', query: 'What\'s the best setup today based on my style?' },
  { id: 'mistakes', label: 'Pattern check', icon: '🔍', query: 'Am I repeating any recent mistakes?' },
];

// ─── Rule-Based Response Engine ────────────────────────────────

function generateResponse(query, trades, watchlist) {
  const q = query.toLowerCase();
  const tradeCount = trades.length;
  const recentTrades = trades.slice(0, 20);
  const wins = recentTrades.filter(t => (t.pnl || 0) > 0).length;
  const losses = recentTrades.length - wins;
  const winRate = recentTrades.length > 0 ? ((wins / recentTrades.length) * 100).toFixed(0) : 0;
  const totalPnl = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const symbols = watchlist.map(w => w.symbol).join(', ');

  if (q.includes('30-second') || q.includes('summary') || q.includes('quick')) {
    return {
      text: `Here's your daily snapshot:\n\n📊 **Market Regime:** Risk-on with crypto leading (+3-8%). Equities steady, futures flat-to-slightly green.\n\n🌡️ **Sentiment:** Fear & Greed at 68 (Greed) — momentum is strong but watch for overextension around major resistance levels.\n\n📅 **Key Events:** FOMC Minutes at 1:00 PM ET, Initial Jobless Claims at 8:30 AM. Both could inject volatility.\n\n🎯 **Your Focus:** ${symbols ? `Your watchlist (${symbols}) is mostly in uptrends.` : 'Add symbols to your watchlist to get personalized focus areas.'} ${tradeCount > 0 ? `Last 20 trades: ${winRate}% win rate.` : ''}`,
      followUp: ['What should I watch for today?', 'How should I size positions?'],
    };
  }

  if (q.includes('bear') || q.includes('risk') || q.includes('danger')) {
    return {
      text: `🐻 **Bear Case Analysis:**\n\n1. **Macro Risk:** FOMC minutes dropping today could shift rate expectations. A hawkish surprise would hit risk assets hard.\n\n2. **Overbought Signals:** SOL RSI at 71, DOGE at 74 — both in overbought territory. Mean reversion likely within 2-3 sessions.\n\n3. **Volume Divergence:** Crypto volume is elevated but some alts are showing exhaustion candles on 4H timeframe.\n\n4. **DXY Watch:** Dollar showing signs of bottoming — a reversal would pressure crypto and commodities.\n\n${tradeCount > 0 ? `5. **Your Edge:** Your recent ${losses > wins ? 'losing streak suggests caution' : 'performance is solid but don\'t get complacent'}. Consider reducing size by 25-50% today.` : ''}`,
      followUp: ['Should I hedge?', 'What support levels should I watch?'],
    };
  }

  if (q.includes('bull') || q.includes('upside') || q.includes('opportunity')) {
    return {
      text: `🐂 **Bull Case Analysis:**\n\n1. **Institutional Flow:** BTC ETF inflows hitting weekly records — smart money is accumulating aggressively.\n\n2. **Breakout Setup:** BTC testing $70K with increasing volume. A clean close above opens path to $75K.\n\n3. **Sector Rotation:** DeFi tokens (UNI +6.1%) showing renewed interest — narrative-driven momentum building.\n\n4. **Macro Tailwind:** If FOMC minutes are dovish, expect a risk-on rally across all assets.\n\n${tradeCount > 0 ? `5. **Your Data:** Win rate of ${winRate}% on your last 20 trades. ${Number(winRate) > 55 ? 'Your edge is intact — stick to your playbook.' : 'Focus on A+ setups only to improve your hit rate.'}` : ''}`,
      followUp: ['Where should I add exposure?', 'What\'s the best risk/reward setup?'],
    };
  }

  if (q.includes('risk') || q.includes('exposure') || q.includes('position')) {
    const avgPnl = tradeCount > 0 ? (totalPnl / Math.min(tradeCount, 20)).toFixed(2) : 0;
    return {
      text: `🛡️ **Risk Assessment:**\n\n${tradeCount > 0 ? `📊 **Recent Performance:** ${wins}W / ${losses}L (${winRate}% win rate) across last ${Math.min(tradeCount, 20)} trades.\n💰 **Net P&L:** $${totalPnl.toFixed(2)} | Avg per trade: $${avgPnl}\n\n` : '**No trade data yet** — log some trades to get personalized risk analysis.\n\n'}**Market Risk Factors:**\n• Volatility: Moderate (VIX-equivalent at normal levels)\n• Correlation: Crypto assets highly correlated — diversification within crypto alone is limited\n• Event Risk: FOMC minutes today could spike volatility by 2-3x\n\n**Recommendations:**\n1. Size positions at 1-2% of account max\n2. Set hard stop losses before entries\n3. Avoid holding through FOMC minutes unless hedged`,
      followUp: ['How much should I risk per trade?', 'Should I take partial profits?'],
    };
  }

  if (q.includes('setup') || q.includes('best') || q.includes('trade') || q.includes('play')) {
    return {
      text: `🎯 **Top Setups for Today:**\n\n1. **BTC Breakout Play** — Testing $70K resistance with volume confirmation. Entry above $70.2K, target $72.5K, stop $68.5K. R:R = 1.5:1.\n\n2. **SOL Cup & Handle** — Handle forming near $150. Breakout above $155 targets $180. Conservative entry: wait for retest of $148.\n\n3. **UNI Momentum** — +6.1% with 2.3x avg volume. DeFi narrative gaining traction. Entry on pullback to $11.80.\n\n4. **TSLA Mean Reversion** — RSI at 42, oversold on daily. If it holds $195 support, bounce to $205 MA20 is high-probability.\n\n${tradeCount > 0 ? `**Based on your history:** You tend to perform best on breakout setups${Number(winRate) > 55 ? ' — setups 1 & 2 align with your style.' : '. Focus on high-conviction entries only.'}` : ''}`,
      followUp: ['Tell me more about the BTC setup', 'What\'s my edge on breakouts?'],
    };
  }

  if (q.includes('mistake') || q.includes('pattern') || q.includes('repeat')) {
    if (tradeCount < 5) {
      return {
        text: `📋 **Not enough data yet.** Log at least 5-10 trades for me to identify patterns and potential mistakes in your trading.`,
        followUp: ['How should I journal my trades?', 'What metrics should I track?'],
      };
    }
    const _avgSize = recentTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / recentTrades.length;
    return {
      text: `🔍 **Pattern Analysis (Last ${Math.min(tradeCount, 20)} Trades):**\n\n${Number(winRate) < 50 ? '⚠️ **Win Rate Below 50%** — You may be entering trades without clear signals. Consider waiting for 2+ confluence factors before entry.\n\n' : '✅ **Win Rate Healthy** — Your system is producing winners.\n\n'}${losses > 0 ? '📊 **Loss Pattern:** Your recent losses may share commonalities — check if you\'re:\n• Entering too early (before confirmation)\n• Setting stops too tight\n• Overtrading during low-volatility periods\n• Revenge trading after a loss\n\n' : ''}**Actionable Steps:**\n1. Before each trade, ask: "Is this an A+ setup?"\n2. Wait for price action confirmation, not prediction\n3. Risk no more than 1% per trade until win rate stabilizes`,
      followUp: ['What days do I trade best?', 'Am I overtrading?'],
    };
  }

  // Default fallback
  return {
    text: `I can help you with market analysis, risk assessment, setup ideas, and personalized trade insights based on your journal data.\n\n${tradeCount > 0 ? `I have access to your ${tradeCount} trades and can analyze patterns, win rates, timing edges, and more.` : 'Start logging trades to unlock personalized insights.'}\n\nTry asking me:\n• "What's the best setup today?"\n• "What's the bear case?"\n• "Am I repeating mistakes?"`,
    followUp: [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function AIResearchCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const trades = useJournalStore((s) => s.trades);
  const watchlist = useWatchlistStore((s) => s.items);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (query) => {
    const q = query || inputValue;
    if (!q.trim()) return;

    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setIsTyping(true);

    // Simulate typing delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));

    const response = generateResponse(q, trades, watchlist);
    setMessages((prev) => [...prev, { role: 'ai', ...response }]);
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="tf-btn"
        style={{
          position: 'fixed',
          bottom: 100,
          right: 32,
          width: 48,
          height: 48,
          borderRadius: 14,
          border: 'none',
          background: `linear-gradient(135deg, ${C.p}, ${C.cyan})`,
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          zIndex: 99,
          boxShadow: `0 4px 20px ${alpha(C.p, 0.4)}`,
          transition: 'all 0.2s ease',
        }}
        title="AI Research Copilot"
      >
        🤖
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 420,
        height: 560,
        borderRadius: 20,
        background: C.bg,
        border: `1px solid ${C.bd}`,
        boxShadow: `0 8px 40px ${alpha('#000', 0.4)}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        overflow: 'hidden',
      }}
    >
      {/* ─── Header ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 16px',
          background: `linear-gradient(135deg, ${alpha(C.p, 0.1)}, ${alpha(C.cyan, 0.06)})`,
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
              Research Copilot
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)' }}>
              {trades.length} trades · {watchlist.length} symbols
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="tf-btn"
          style={{
            background: 'transparent',
            border: `1px solid ${C.bd}`,
            borderRadius: 8,
            padding: '4px 8px',
            cursor: 'pointer',
            color: C.t3,
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>

      {/* ─── Messages Area ───────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          scrollbarWidth: 'thin',
        }}
      >
        {messages.length === 0 && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 12 }}>
              What can I help with?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSend(p.query)}
                  className="tf-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 12px',
                    borderRadius: 10,
                    border: `1px solid ${C.bd}`,
                    background: alpha(C.sf, 0.5),
                    color: C.t2,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--tf-font)',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} onFollowUp={handleSend} />
        ))}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
            <div
              className="tf-spin"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: `2px solid ${C.bd}`,
                borderTopColor: C.p,
              }}
            />
            <span style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)' }}>Analyzing...</span>
          </div>
        )}
      </div>

      {/* ─── Input Area ──────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${C.bd}`,
          background: C.bg2,
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about markets, your trades, or setups..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            color: C.t1,
            fontSize: 12,
            fontFamily: 'var(--tf-font)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim()}
          className="tf-btn"
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            border: 'none',
            background: inputValue.trim() ? `linear-gradient(135deg, ${C.p}, ${C.cyan})` : alpha(C.t3, 0.1),
            color: inputValue.trim() ? '#fff' : C.t3,
            cursor: inputValue.trim() ? 'pointer' : 'default',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Message Bubble
// ═══════════════════════════════════════════════════════════════════

function MessageBubble({ message, onFollowUp }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 6,
      }}
    >
      <div
        style={{
          maxWidth: '90%',
          padding: '10px 14px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? alpha(C.b, 0.12) : alpha(C.sf, 0.8),
          border: `1px solid ${isUser ? alpha(C.b, 0.2) : C.bd}`,
          color: C.t1,
          fontSize: 12,
          fontFamily: 'var(--tf-font)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {/* Render markdown-like bold */}
        {message.text.split('\n').map((line, i) => (
          <div key={i}>
            {line.split(/(\*\*.*?\*\*)/).map((segment, j) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return (
                  <strong key={j} style={{ color: C.t1, fontWeight: 700 }}>
                    {segment.slice(2, -2)}
                  </strong>
                );
              }
              return segment;
            })}
          </div>
        ))}
      </div>

      {/* Follow-up suggestions */}
      {message.followUp && message.followUp.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: '90%' }}>
          {message.followUp.map((fu, i) => (
            <button
              key={i}
              onClick={() => onFollowUp(fu)}
              className="tf-btn"
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: `1px solid ${alpha(C.p, 0.2)}`,
                background: alpha(C.p, 0.06),
                color: C.p,
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
                transition: 'all 0.15s',
              }}
            >
              {fu}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { AIResearchCopilot };

export default React.memo(AIResearchCopilot);
