// ═══════════════════════════════════════════════════════════════════
// charEdge — Research Panel (Phase B Sprint 6)
//
// Persistent right-side panel replacing the floating AI copilot.
// Sections: Watchlist Mini-Prices, Fear & Greed Mini, Notes, Copilot
// Collapses to 44px icon rail on < 1200px viewport.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';
import s from './ResearchPanel.module.css';

// ─── Simulated mini-prices (in production, use live feed) ────────
const MOCK_PRICES = {
  ES:   { price: 5285.50, change: +0.42 },
  NQ:   { price: 18452.25, change: +0.67 },
  BTC:  { price: 68425.00, change: +2.14 },
  ETH:  { price: 3842.18, change: +1.89 },
  AAPL: { price: 189.72, change: -0.31 },
  SPY:  { price: 528.45, change: +0.38 },
  SOL:  { price: 148.62, change: +4.21 },
  DOGE: { price: 0.1245, change: -1.02 },
};

// ─── Fear & Greed Mini ──────────────────────────────────────────
const MOCK_FG = { value: 68, label: 'Greed' };

function getGradientColor(value) {
  if (value <= 20) return '#e74c3c';
  if (value <= 40) return '#e67e22';
  if (value <= 60) return '#f1c40f';
  if (value <= 80) return '#2ecc71';
  return '#27ae60';
}

// ─── Copilot Response Engine (inline) ───────────────────────────
function generateQuickResponse(query, trades) {
  const q = query.toLowerCase();
  const count = trades.length;
  const recent = trades.slice(0, 20);
  const wins = recent.filter(t => (t.pnl || 0) > 0).length;
  const winRate = recent.length > 0 ? ((wins / recent.length) * 100).toFixed(0) : 0;

  if (q.includes('summary') || q.includes('quick') || q.includes('30-second'))
    return `📊 Market: Risk-on, crypto leading. F&G at 68 (Greed). ${count > 0 ? `Your win rate: ${winRate}%.` : ''}`;
  if (q.includes('bear') || q.includes('risk'))
    return `🐻 FOMC risk today. Overbought signals on SOL/DOGE. Consider reducing size 25-50%.`;
  if (q.includes('bull') || q.includes('upside'))
    return `🐂 BTC ETF inflows record. DeFi narrative strong. BTC testing $70K resistance.`;
  if (q.includes('setup') || q.includes('trade'))
    return `🎯 Top: BTC breakout >$70.2K (target $72.5K), SOL cup & handle near $150, UNI momentum.`;
  return `I can help with market analysis, risk checks, and setup ideas. ${count > 0 ? `Analyzing ${count} trades.` : ''}`;
}

// ═══════════════════════════════════════════════════════════════════
// ResearchPanel Component
// ═══════════════════════════════════════════════════════════════════

function ResearchPanel({ onCompose }) {
  const [collapsed, setCollapsed] = useState(false);
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem('tf-research-notes') || ''; }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (_) { return ''; }
  });
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const watchlist = useWatchlistStore((s) => s.items);
  const trades = useJournalStore((s) => s.trades);

  // Persist notes
  const saveNotes = useCallback((val) => {
    setNotes(val);
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { localStorage.setItem('tf-research-notes', val); } catch (_) { /* storage may be blocked */ }
  }, []);

  // Auto-scroll copilot
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [copilotMessages]);

  // Responsive collapse
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1200px)');
    const handler = (e) => setCollapsed(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleCopilotSend = async () => {
    const q = copilotInput.trim();
    if (!q) return;
    setCopilotInput('');
    setCopilotMessages(prev => [...prev, { role: 'user', text: q }]);
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    const response = generateQuickResponse(q, trades);
    setCopilotMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsTyping(false);
  };

  // ─── Collapsed Rail ─────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        style={{
          width: 44,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '12px 0',
          background: alpha(C.bg2, 0.8),
          borderLeft: `1px solid ${C.bd}`,
          borderRadius: '16px 0 0 16px',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          title="Expand Research Panel"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: alpha(C.b, 0.1), color: C.b,
            cursor: 'pointer', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ◀
        </button>
        <div title="Watchlist" className={s.s0}>📋</div>
        <div title="Fear & Greed" className={s.s1}>🌡️</div>
        <div title="Notes" className={s.s2}>📝</div>
        <div title="AI Copilot" className={s.s3}>🤖</div>
      </div>
    );
  }

  // ─── Expanded Panel ─────────────────────────────────────────
  return (
    <div
      style={{
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: alpha(C.bg2, 0.85),
        borderLeft: `1px solid ${C.bd}`,
        borderRadius: '16px 0 0 16px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        overflow: 'hidden',
        height: 'calc(100vh - 56px)',
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: alpha(C.sf, 0.3),
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
          Research
        </span>
        <div className={s.s4}>
          {onCompose && (
            <button
              onClick={onCompose}
              style={{
                padding: '4px 10px', borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${C.b}, ${C.bH})`,
                color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--tf-font)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              + Compose
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            style={{
              width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.bd}`,
              background: 'transparent', color: C.t3,
              cursor: 'pointer', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* ─── Scrollable Content ─────────────────────────────── */}
      <div className={s.s5}>
        {/* ── Watchlist Mini-Prices ──────────────────────────── */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${alpha(C.bd, 0.5)}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--tf-font)' }}>
            Watchlist
          </div>
          <div className={s.s6}>
            {watchlist.slice(0, 6).map((item) => {
              const p = MOCK_PRICES[item.symbol] || { price: 0, change: 0 };
              const changeColor = p.change >= 0 ? C.g : C.r;
              return (
                <div
                  key={item.symbol}
                  className={s.s7}
                  onMouseEnter={(e) => e.currentTarget.style.background = alpha(C.t3, 0.06)}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-mono)' }}>{item.symbol}</span>
                    <span style={{ fontSize: 10, color: C.t3, marginLeft: 6, fontFamily: 'var(--tf-font)' }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-mono)' }}>
                      {p.price > 1000 ? p.price.toLocaleString() : p.price.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: changeColor, fontFamily: 'var(--tf-mono)' }}>
                      {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
            {watchlist.length === 0 && (
              <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)', textAlign: 'center', padding: 12 }}>
                No symbols in watchlist
              </div>
            )}
          </div>
        </div>

        {/* ── Fear & Greed Mini ──────────────────────────────── */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${alpha(C.bd, 0.5)}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--tf-font)' }}>
            Market Sentiment
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              background: alpha(C.sf, 0.4),
              borderRadius: 10,
            }}
          >
            {/* Mini gauge */}
            <div
              style={{
                width: 44, height: 44,
                borderRadius: '50%',
                background: `conic-gradient(${getGradientColor(MOCK_FG.value)} ${MOCK_FG.value * 3.6}deg, ${alpha(C.t3, 0.1)} 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: C.bg2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: getGradientColor(MOCK_FG.value),
                  fontFamily: 'var(--tf-mono)',
                }}
              >
                {MOCK_FG.value}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: getGradientColor(MOCK_FG.value), fontFamily: 'var(--tf-font)' }}>
                {MOCK_FG.label}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)' }}>Fear & Greed Index</div>
            </div>
          </div>
        </div>

        {/* ── Quick Notes ────────────────────────────────────── */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${alpha(C.bd, 0.5)}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--tf-font)' }}>
            Quick Notes
          </div>
          <textarea
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder="Jot down ideas, levels, or reminders..."
            style={{
              width: '100%',
              height: 80,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${C.bd}`,
              background: alpha(C.sf, 0.4),
              color: C.t1,
              fontSize: 11,
              fontFamily: 'var(--tf-font)',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── AI Copilot ─────────────────────────────────────── */}
        <div className={s.s8}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--tf-font)' }}>
            AI Copilot
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className={s.s9}
          >
            {copilotMessages.length === 0 && (
              <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)', textAlign: 'center', padding: '16px 8px' }}>
                Ask about markets, your trades, or setups...
              </div>
            )}
            {copilotMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  background: msg.role === 'user' ? alpha(C.b, 0.1) : alpha(C.sf, 0.6),
                  border: `1px solid ${msg.role === 'user' ? alpha(C.b, 0.2) : C.bd}`,
                  fontSize: 11,
                  color: C.t1,
                  fontFamily: 'var(--tf-font)',
                  lineHeight: 1.6,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className={s.s10}>
                <div className="tf-spin" style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.bd}`, borderTopColor: C.p }} />
                <span style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)' }}>Analyzing...</span>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {copilotMessages.length === 0 && (
            <div className={s.s11}>
              {['30s summary', 'Bear case', 'Best setup'].map((label) => (
                <button
                  key={label}
                  onClick={() => { setCopilotInput(label); setTimeout(() => { setCopilotInput(label); handleCopilotSend(); }, 10); }}
                  style={{
                    padding: '4px 8px', borderRadius: 6,
                    border: `1px solid ${C.bd}`,
                    background: alpha(C.sf, 0.4),
                    color: C.t2, fontSize: 10, fontWeight: 600,
                    fontFamily: 'var(--tf-font)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className={s.s12}>
            <input
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCopilotSend(); } }}
              placeholder="Ask the copilot..."
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${C.bd}`,
                background: alpha(C.sf, 0.4),
                color: C.t1,
                fontSize: 11,
                fontFamily: 'var(--tf-font)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCopilotSend}
              disabled={!copilotInput.trim()}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: copilotInput.trim() ? `linear-gradient(135deg, ${C.p}, ${C.cyan})` : alpha(C.t3, 0.1),
                color: copilotInput.trim() ? '#fff' : C.t3,
                cursor: copilotInput.trim() ? 'pointer' : 'default',
                fontSize: 13,
                fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ResearchPanel };

export default React.memo(ResearchPanel);
