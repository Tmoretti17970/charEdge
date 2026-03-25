// ═══════════════════════════════════════════════════════════════════
// charEdge — Discovery Onboarding & Empty States
//
// Sprint 20: Guided first-use experience for Discover tab.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const MARKETS = [
  { id: 'stocks', icon: '📈', label: 'US Stocks' },
  { id: 'crypto', icon: '₿', label: 'Crypto' },
  { id: 'forex', icon: '💱', label: 'Forex' },
  { id: 'commodities', icon: '🛢️', label: 'Commodities' },
  { id: 'options', icon: '📊', label: 'Options' },
];

const QUICK_SYMBOLS = {
  stocks: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'JPM', 'SPY', 'QQQ'],
  crypto: ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK'],
  forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
  commodities: ['GC', 'CL', 'SI', 'NG'],
  options: ['SPX', 'VIX', 'IWM', 'DIA'],
};

const STYLES = [
  { id: 'daytrader', icon: '📊', label: 'Day Trader', desc: 'Scalps & intraday setups' },
  { id: 'swing', icon: '📈', label: 'Swing Trader', desc: 'Multi-day to multi-week' },
  { id: 'investor', icon: '💼', label: 'Investor', desc: 'Long-term fundamentals' },
  { id: 'learner', icon: '🎓', label: 'Still Learning', desc: 'Show me the basics' },
];

function DiscoverOnboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);

  const toggleMarket = (id) => {
    setSelectedMarkets((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };
  const toggleSymbol = (sym) => {
    setSelectedSymbols((s) => (s.includes(sym) ? s.filter((x) => x !== sym) : [...s, sym]));
  };

  const availableSymbols = selectedMarkets.flatMap((m) => QUICK_SYMBOLS[m] || []);

  const finish = () => {
    if (onComplete) onComplete({ markets: selectedMarkets, symbols: selectedSymbols, style: selectedStyle });
  };

  return (
    <div
      style={{
        background: alpha(C.bg, 0.97),
        border: `1px solid ${C.bd}`,
        borderRadius: 20,
        padding: '32px 28px',
        maxWidth: 520,
        margin: '0 auto 24px',
        boxShadow: `0 12px 48px ${alpha('#000', 0.25)}`,
      }}
    >
      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: s <= step ? `linear-gradient(90deg, ${C.b}, ${C.p})` : alpha(C.t3, 0.2),
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Step 1: Pick Markets */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 6 }}>
            Welcome to Discover 🚀
          </div>
          <div style={{ fontSize: 13, color: C.t2, fontFamily: 'var(--tf-font)', marginBottom: 20, lineHeight: 1.5 }}>
            What markets are you interested in?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {MARKETS.map((m) => {
              const active = selectedMarkets.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMarket(m.id)}
                  className="tf-btn"
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: `2px solid ${active ? C.b : alpha(C.bd, 0.5)}`,
                    background: active ? alpha(C.b, 0.08) : alpha(C.sf, 0.4),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: active ? C.b : C.t1, fontFamily: 'var(--tf-font)' }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={selectedMarkets.length === 0}
            className="tf-btn"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: selectedMarkets.length > 0 ? `linear-gradient(135deg, ${C.b}, ${C.p})` : alpha(C.t3, 0.2),
              color: '#fff',
              cursor: selectedMarkets.length > 0 ? 'pointer' : 'default',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--tf-font)',
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Build Watchlist */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 6 }}>
            Build Your Watchlist ⭐
          </div>
          <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-font)', marginBottom: 16 }}>
            Tap symbols to add them. You can always change these later.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {availableSymbols.map((sym) => {
              const active = selectedSymbols.includes(sym);
              return (
                <button
                  key={sym}
                  onClick={() => toggleSymbol(sym)}
                  className="tf-btn"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1px solid ${active ? C.g : alpha(C.bd, 0.5)}`,
                    background: active ? alpha(C.g, 0.1) : 'transparent',
                    color: active ? C.g : C.t2,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--tf-mono)',
                  }}
                >
                  {active ? '✓ ' : ''}
                  {sym}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setStep(1)}
              className="tf-btn"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t3,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--tf-font)',
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="tf-btn"
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: `linear-gradient(135deg, ${C.b}, ${C.p})`,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--tf-font)',
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Style */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 6 }}>
            Your Trading Style 🎯
          </div>
          <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-font)', marginBottom: 16 }}>
            We'll personalize your layout based on this.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {STYLES.map((s) => {
              const active = selectedStyle === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  className="tf-btn"
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: `2px solid ${active ? C.b : alpha(C.bd, 0.5)}`,
                    background: active ? alpha(C.b, 0.06) : alpha(C.sf, 0.4),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: active ? C.b : C.t1,
                        fontFamily: 'var(--tf-font)',
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)' }}>{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setStep(2)}
              className="tf-btn"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t3,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--tf-font)',
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!selectedStyle}
              className="tf-btn"
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: selectedStyle ? `linear-gradient(135deg, ${C.b}, ${C.p})` : alpha(C.t3, 0.2),
                color: '#fff',
                cursor: selectedStyle ? 'pointer' : 'default',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--tf-font)',
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Ready */}
      {step === 4 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', marginBottom: 8 }}>
            Your Discover Page is Ready!
          </div>
          <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-font)', marginBottom: 6 }}>
            {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} · {selectedSymbols.length} symbol
            {selectedSymbols.length !== 1 ? 's' : ''} · {STYLES.find((s) => s.id === selectedStyle)?.label || 'Custom'}{' '}
            layout
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)', marginBottom: 24, lineHeight: 1.5 }}>
            We've personalized your Discover feed based on your preferences.
            <br />
            You can change these anytime in the Layout settings.
          </div>
          <button
            onClick={finish}
            className="tf-btn"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: `linear-gradient(135deg, ${C.b}, ${C.p})`,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'var(--tf-font)',
            }}
          >
            🚀 Let's Go!
          </button>
        </div>
      )}
    </div>
  );
}

export { DiscoverOnboarding };

export default React.memo(DiscoverOnboarding);
