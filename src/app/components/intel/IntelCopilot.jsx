// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Copilot
//
// Context-aware AI research assistant bar for the Intel page.
// Features:
//   - Persistent bar at the bottom, expands on focus
//   - Quick prompt chips that change based on activeSection prop
//   - Rule-based responses using trade journal & watchlist data
//   - Glass-effect bar with pulsing AI orb indicator
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { aiRouter } from '../../../ai/AIRouter.ts';
import { journalRAG } from '../../../ai/JournalRAG.ts';
import { traderDNA } from '../../../ai/TraderDNA.ts';
import { C, F } from '../../../constants.js';
import { trackFeatureUse } from '../../../observability/telemetry.ts';
import { useJournalStore } from '../../../state/useJournalStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Section-Specific Quick Prompts ─────────────────────────────

const SECTION_PROMPTS = {
  brief: [
    { label: 'Expand on this', query: 'Expand on this briefing in more detail' },
    { label: 'What did I miss?', query: 'What important things did I miss today?' },
    { label: 'Risk check', query: 'How is my risk exposure looking right now?' },
  ],
  signals: [
    { label: 'Explain this flow', query: 'Explain the current options flow activity' },
    { label: 'Is this bullish?', query: 'Is the current signal setup bullish or bearish?' },
    { label: "What's unusual?", query: "What's unusual about today's market signals?" },
  ],
  research: [
    { label: 'Compare sectors', query: 'Compare sector performance and rotation trends' },
    { label: 'Best setup today', query: "What's the best trading setup today?" },
    { label: 'Screener for breakouts', query: 'Run a screener for breakout candidates' },
  ],
  macro: [
    { label: 'Rate cut impact?', query: 'How would a rate cut impact my positions?' },
    { label: 'How does this affect me?', query: 'How do these macro events affect my portfolio?' },
    { label: 'Contrarian case', query: "What's the contrarian case on the macro outlook?" },
  ],
  default: [
    { label: '30-second summary', query: "Give me the 30-second version of today's markets" },
    { label: 'Bull case', query: "What's the bull case right now?" },
    { label: 'Bear case', query: "What's the bear case right now?" },
    { label: 'Best setup', query: "What's the best setup today based on my style?" },
    { label: 'Risk check', query: 'How is my risk exposure looking?' },
  ],
};

// ─── Rule-Based Response Engine ─────────────────────────────────

function generateResponse(query, trades, watchlist, activeSection) {
  const q = query.toLowerCase();
  const tradeCount = trades.length;
  const recentTrades = trades.slice(0, 20);
  const wins = recentTrades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = recentTrades.length - wins;
  const winRate = recentTrades.length > 0 ? ((wins / recentTrades.length) * 100).toFixed(0) : 0;
  const totalPnl = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const symbols = watchlist.map((w) => w.symbol).join(', ');

  // Section-specific responses
  if (activeSection === 'brief' || q.includes('expand') || q.includes('miss')) {
    return {
      text: `**Today's Extended Briefing:**\n\nMarkets opened mixed with tech leading on AI momentum. Key takeaways:\n\n1. **Equities:** S&P futures up 0.3%, Nasdaq +0.6%. Semiconductor names driving gains.\n2. **Crypto:** BTC consolidating near key resistance. ETF inflows steady at $200M+ daily.\n3. **Macro:** FOMC minutes due today — markets pricing in 72% chance of June cut.\n4. **Volatility:** VIX at 14.2, well below average. Complacency building.\n\n${tradeCount > 0 ? `Your recent ${winRate}% win rate suggests your edge is ${Number(winRate) > 55 ? 'intact' : 'needs attention'}.` : 'Log trades to get personalized context.'}`,
      followUp: ['What should I focus on?', 'Biggest risk today?'],
    };
  }

  if (activeSection === 'signals' || q.includes('flow') || q.includes('signal') || q.includes('unusual')) {
    return {
      text: `**Signal Analysis:**\n\n1. **Options Flow:** Unusual call buying on NVDA ($900 strike, Jun expiry) — $12M notional. Institutional positioning suggests upside conviction.\n2. **Dark Pool:** Large block prints in AAPL ($195-198 range) — accumulation pattern.\n3. **Sentiment:** Put/call ratio at 0.72, moderately bullish. Social sentiment for BTC at 78/100.\n\n${symbols ? `Watching: ${symbols}. Flow data suggests mixed positioning across your watchlist.` : 'Add watchlist symbols for targeted flow analysis.'}`,
      followUp: ['Is this smart money?', 'How should I position?'],
    };
  }

  if (q.includes('sector') || q.includes('compare') || q.includes('rotation')) {
    return {
      text: `**Sector Comparison:**\n\n1. **Technology** (+1.4%): Leading on AI/chip momentum. Overbought on weekly RSI.\n2. **Healthcare** (+0.8%): Defensive rotation starting. Pharma outperforming biotech.\n3. **Energy** (-0.3%): Oil flat, natural gas weak. Seasonal headwinds.\n4. **Financials** (+0.5%): Banks benefiting from steeper yield curve expectations.\n\n**Rotation Signal:** Money flowing from energy/materials into tech/healthcare. Classic late-cycle pattern — watch for reversal signs.`,
      followUp: ['Best sector to trade?', 'Rotation history'],
    };
  }

  if (q.includes('rate cut') || q.includes('macro') || q.includes('affect')) {
    return {
      text: `**Rate Cut Impact Analysis:**\n\nPrediction markets show 72% probability of Fed cut by June.\n\n**If Cut Happens:**\n- Growth stocks rally 3-5% (tech, small caps)\n- Dollar weakens, benefiting crypto & commodities\n- Bond yields drop, REITs and utilities outperform\n\n**If Delayed:**\n- Risk-off rotation into treasuries\n- Growth stocks correct 2-4%\n- Dollar strengthens, crypto faces headwind\n\n${tradeCount > 0 ? `**Your Portfolio:** With ${tradeCount} recent trades, ${wins > losses ? 'your bullish bias would benefit from a cut scenario.' : 'consider hedging exposure ahead of the decision.'}` : ''}`,
      followUp: ['How to hedge?', 'Best rate cut plays'],
    };
  }

  if (q.includes('contrarian') || q.includes('bear')) {
    return {
      text: `**Contrarian / Bear Case:**\n\n1. **Valuation Stretch:** S&P forward P/E at 21x — above 5-year average. Earnings need to grow 15%+ to justify.\n2. **Liquidity Drain:** QT continues at $60B/month. Bank reserves declining quietly.\n3. **Credit Stress:** High-yield spreads tightening to post-2021 lows — complacency indicator.\n4. **Geopolitical:** China tariff risk at 42% per prediction markets. Escalation would hit supply chains.\n5. **Positioning:** Everyone is long. Net speculative positioning in S&P futures near extremes.\n\n**Bottom Line:** The consensus is bullish. History says that's when you need to be careful.`,
      followUp: ['How to protect downside?', 'Best hedge right now'],
    };
  }

  if (q.includes('bull') || q.includes('upside')) {
    return {
      text: `**Bull Case:**\n\n1. **AI Supercycle:** Enterprise AI spending accelerating. NVDA, AVGO, AMD all guiding higher.\n2. **Earnings Growth:** Q1 earnings expected +8% YoY. Tech leading at +15%.\n3. **Rate Cuts Coming:** Market expects 2-3 cuts in 2026. Lower rates = higher multiples.\n4. **Institutional Inflows:** Record ETF inflows across equity and crypto products.\n\n${tradeCount > 0 ? `With your ${winRate}% win rate, ${Number(winRate) > 55 ? 'your momentum-based approach aligns well with this environment.' : 'focus on the highest-conviction setups in this bullish backdrop.'}` : ''}`,
      followUp: ['Where to add exposure?', 'Best risk/reward setup'],
    };
  }

  if (q.includes('setup') || q.includes('best') || q.includes('breakout') || q.includes('screener')) {
    return {
      text: `**Top Setups Today:**\n\n1. **NVDA Breakout** — Consolidating above $880. Entry on break of $895, target $940, stop $870. R:R 1.8:1.\n2. **BTC Range Play** — Support at $67K, resistance $70K. Fade the range or wait for breakout.\n3. **UNI DeFi Momentum** — Volume surge +230%. Entry on pullback to $11.50, target $14.\n4. **TSLA Oversold Bounce** — RSI at 38 on daily. If $195 holds, bounce to $210 MA.\n\n${tradeCount > 0 ? `Based on your journal: you perform best on breakout plays with ${Number(winRate) > 55 ? 'strong' : 'improving'} execution.` : 'Log trades to unlock personalized setup recommendations.'}`,
      followUp: ['More detail on NVDA', 'Position sizing?'],
    };
  }

  if (q.includes('summary') || q.includes('30-second') || q.includes('quick')) {
    return {
      text: `**30-Second Market Summary:**\n\nMarkets: Risk-on. S&P +0.3%, Nasdaq +0.6%, BTC holding $68K.\nSentiment: Fear & Greed at 68 (Greed). Momentum strong but stretched.\nKey Event: FOMC minutes today at 1 PM ET.\nFlow: Institutional call buying in tech. Dark pool accumulation in mega-caps.\n\n${symbols ? `Your watchlist (${symbols}) — mostly trending with the market.` : 'Add symbols for personalized tracking.'}`,
      followUp: ['What to watch for?', 'Risk assessment'],
    };
  }

  if (q.includes('risk') || q.includes('exposure')) {
    const avgPnl = tradeCount > 0 ? (totalPnl / Math.min(tradeCount, 20)).toFixed(2) : 0;
    return {
      text: `**Risk Assessment:**\n\n${tradeCount > 0 ? `Recent Performance: ${wins}W / ${losses}L (${winRate}% win rate)\nNet P&L: $${totalPnl.toFixed(2)} | Avg/trade: $${avgPnl}\n\n` : 'No trade data yet.\n\n'}**Market Risk Factors:**\n- Volatility: Low (VIX 14.2) — can spike quickly on surprises\n- Correlation: High across risk assets\n- Event Risk: FOMC minutes today\n\n**Recommendations:**\n1. Size at 1-2% max per trade\n2. Hard stops before entry\n3. Reduce exposure ahead of FOMC`,
      followUp: ['Position sizing advice', 'Should I hedge?'],
    };
  }

  // Default fallback
  return {
    text: `I can help with market analysis, risk assessment, trade setups, and personalized insights.\n\n${tradeCount > 0 ? `I see ${tradeCount} trades in your journal — I can analyze patterns, win rates, and more.` : 'Start logging trades for personalized insights.'}\n\nTry: "Best setup today", "Bear case", or "Risk check"`,
    followUp: [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function IntelCopilot({ activeSection = 'default' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [response, setResponse] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [responseTier, setResponseTier] = useState(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const trades = useJournalStore((s) => s.trades);
  const watchlist = useWatchlistStore((s) => s.items);

  const prompts = SECTION_PROMPTS[activeSection] || SECTION_PROMPTS.default;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Only collapse if there's no active response
        if (!response) {
          setIsExpanded(false);
        }
      }
    }
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, response]);

  const handleSend = async (query) => {
    const q = query || inputValue;
    if (!q.trim()) return;

    trackFeatureUse('intel_copilot_query', { section: activeSection });
    setInputValue('');
    setIsExpanded(true);
    setIsTyping(true);
    setResponseTier(null);

    try {
      // Determine route type based on query content
      const isBriefing = /\b(brief|expand|miss|summary|30-second|quick)\b/i.test(q);
      const routeType = isBriefing ? 'narrate' : 'analyze';

      // Build system prompt with context
      let systemPrompt = `You are a trading copilot. Active section: ${activeSection}.`;
      try {
        const dna = traderDNA.getDNAForPrompt();
        if (dna) systemPrompt += `\n\nTrader DNA: ${dna}`;
      } catch {
        // TraderDNA not ready — skip
      }

      // Inject JournalRAG context for trade-related queries
      let ragContext = '';
      if (/\b(my\s+trade|win\s*rate|journal|history)\b/i.test(q)) {
        try {
          const ragResult = await journalRAG.query(q, 5);
          if (ragResult && ragResult.context) {
            ragContext = `\n\nRelevant journal context:\n${ragResult.context}`;
          }
        } catch {
          // RAG unavailable — proceed without
        }
      }

      if (ragContext) {
        systemPrompt += ragContext;
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: q },
      ];

      // Try streaming first
      let streamed = false;
      let streamedContent = '';
      let streamTier = null;

      try {
        const generator = aiRouter.stream({ type: routeType, messages, maxTokens: 300, stream: true });
        let iterResult = await generator.next();

        if (!iterResult.done) {
          streamed = true;
          // Show streaming response progressively
          setIsTyping(false);
          setResponse({ query: q, text: '', followUp: [] });

          while (!iterResult.done) {
            streamedContent += iterResult.value;
            setResponse({ query: q, text: streamedContent, followUp: [] });
            iterResult = await generator.next();
          }

          // The return value of the generator holds the AIResponse metadata
          const finalMeta = iterResult.value;
          if (finalMeta && finalMeta.tier) {
            streamTier = finalMeta.tier;
          }
          setResponseTier(streamTier || 'L4');
          return;
        }
      } catch {
        // Streaming not available — try non-streaming route
      }

      if (!streamed) {
        const aiResult = await aiRouter.route({ type: routeType, messages, maxTokens: 300 });
        if (aiResult && aiResult.content) {
          setResponse({ query: q, text: aiResult.content, followUp: [] });
          setResponseTier(aiResult.tier || 'L3');
          setIsTyping(false);
          return;
        }
      }

      // If we reached here, AI didn't produce a result — fall back
      throw new Error('No AI response');
    } catch {
      // Fallback to rule-based response engine
      // Simulate brief typing delay for rule-based
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
      const result = generateResponse(q, trades, watchlist, activeSection);
      setResponse({ query: q, ...result });
      setResponseTier('L1');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setResponse(null);
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setResponse(null);
    setResponseTier(null);
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s ease',
      }}
    >
      {/* ─── Expanded Response Panel ───────────────────────────── */}
      {isExpanded && (response || isTyping) && (
        <div
          role="log"
          aria-live="polite"
          aria-busy={isTyping}
          style={{
            background: C.bg2,
            borderRadius: '14px 14px 0 0',
            border: `1px solid ${C.bd}`,
            borderBottom: 'none',
            padding: 16,
            maxHeight: 320,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
          }}
        >
          {/* Close button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: `1px solid ${C.bd}`,
                borderRadius: 6,
                padding: '2px 8px',
                cursor: 'pointer',
                color: C.t3,
                fontSize: 11,
                fontFamily: F,
              }}
            >
              Close
            </button>
          </div>

          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: C.b,
                  animation: 'intelOrbPulse 1.2s ease infinite',
                }}
              />
              <span style={{ fontSize: 12, color: C.t3, fontFamily: F }}>Analyzing...</span>
            </div>
          )}

          {response && !isTyping && (
            <div>
              {/* User query + tier badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: C.t3,
                    fontFamily: F,
                    fontStyle: 'italic',
                  }}
                >
                  {response.query}
                </div>
                {responseTier && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: 'var(--tf-mono)',
                      color: responseTier === 'L1' ? C.t3 : responseTier === 'L4' ? C.b : alpha(C.b, 0.8),
                      background: responseTier === 'L1' ? alpha(C.t3, 0.1) : alpha(C.b, 0.1),
                      border: `1px solid ${responseTier === 'L1' ? alpha(C.t3, 0.2) : alpha(C.b, 0.2)}`,
                      borderRadius: 4,
                      padding: '1px 5px',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    {responseTier}
                  </span>
                )}
              </div>

              {/* AI response */}
              <div
                style={{
                  fontSize: 12,
                  color: C.t1,
                  fontFamily: F,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {response.text.split('\n').map((line, i) => (
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

              {/* Follow-up chips */}
              {response.followUp && response.followUp.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {response.followUp.map((fu, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(fu)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: `1px solid ${alpha(C.b, 0.25)}`,
                        background: alpha(C.b, 0.08),
                        color: C.b,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: F,
                        transition: 'all 0.15s',
                      }}
                    >
                      {fu}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Main Bar (Glass Effect) ───────────────────────────── */}
      <div
        style={{
          background: alpha(C.bg, 0.85),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${C.bd}`,
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: isExpanded ? 10 : 0,
        }}
      >
        {/* Quick Prompt Chips (visible when expanded or no response) */}
        {(isExpanded || !response) && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 2,
            }}
          >
            {prompts.map((p, i) => (
              <button
                key={i}
                aria-label={`Ask: ${p.label}`}
                onClick={() => {
                  trackFeatureUse('intel_copilot_quick_prompt', { prompt: p.label });
                  handleSend(p.query);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: `1px solid ${C.bd}`,
                  background: alpha(C.sf, 0.5),
                  color: C.t2,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: F,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* AI Orb Indicator */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.b,
              boxShadow: `0 0 6px ${alpha(C.b, 0.5)}`,
              animation: 'intelOrbPulse 2s ease infinite',
              flexShrink: 0,
            }}
          />

          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder="Ask about today's markets..."
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 10,
              border: `1px solid ${C.bd}`,
              background: alpha(C.sf, 0.4),
              color: C.t1,
              fontSize: 12,
              fontFamily: F,
              outline: 'none',
              transition: 'all 0.2s',
            }}
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'none',
              background: inputValue.trim() ? `linear-gradient(135deg, ${C.b}, ${alpha(C.b, 0.7)})` : alpha(C.t3, 0.1),
              color: inputValue.trim() ? '#fff' : C.t3,
              cursor: inputValue.trim() ? 'pointer' : 'default',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: F,
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* ─── Keyframe Animations ───────────────────────────────── */}
      <style>{`
        @keyframes intelOrbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default React.memo(IntelCopilot);
