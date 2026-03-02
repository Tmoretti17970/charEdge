// ═══════════════════════════════════════════════════════════════════
// charEdge — Pre-Trade Panel (H2.3)
//
// Interactive form for pre-trade analysis. User selects symbol, side,
// strategy, and emotion, then runs the analyzer for confidence scores,
// historical matches, warnings, and recommendations.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useAICoachStore } from '../../../state/useAICoachStore.js';

const CONFIDENCE_COLORS = {
  high: '#00E676', medium: '#FFCA28', low: '#EF5350',
};

const EMOTIONS = ['Confident', 'Calm', 'Focused', 'Anxious', 'Frustrated', 'Fearful', 'Neutral', 'Excited'];

export default function PreTradePanel() {
  const trades = useJournalStore(s => s.trades);
  const playbooks = useJournalStore(s => s.playbooks);
  const analyzeSetup = useAICoachStore(s => s.analyzeSetup);
  const preTrades = useAICoachStore(s => s.preTrades);

  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('long');
  const [strategy, setStrategy] = useState('none');
  const [emotion, setEmotion] = useState('');
  const [result, setResult] = useState(null);

  const strategies = useMemo(() => {
    const names = playbooks.map(p => p.name || p.title).filter(Boolean);
    return ['none', ...new Set(names)];
  }, [playbooks]);

  const handleAnalyze = useCallback(() => {
    if (!symbol.trim()) return;
    const hour = new Date().getHours();
    const setup = {
      symbol: symbol.trim().toUpperCase(),
      side,
      strategy: strategy !== 'none' ? strategy : undefined,
      timeOfDay: hour,
      emotion: emotion || undefined,
    };
    const r = analyzeSetup(setup, trades, null);
    setResult(r);
  }, [symbol, side, strategy, emotion, trades, analyzeSetup]);

  const confColor = result ? CONFIDENCE_COLORS[result.confidence] || C.t3 : C.t3;

  return (
    <div>
      {/* Input Form */}
      <div style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 14 }}>
          🔍 Analyze a Setup
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <InputField label="Symbol" value={symbol} onChange={setSymbol} placeholder="AAPL" />
          <SelectField label="Side" value={side} onChange={setSide} options={[{ v: 'long', l: 'Long' }, { v: 'short', l: 'Short' }]} />
          <SelectField label="Strategy" value={strategy} onChange={setStrategy}
            options={strategies.map(s => ({ v: s, l: s === 'none' ? 'Any' : s }))} />
          <SelectField label="Emotion" value={emotion} onChange={setEmotion}
            options={[{ v: '', l: 'Any' }, ...EMOTIONS.map(e => ({ v: e, l: e }))]} />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!symbol.trim()}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: symbol.trim() ? `linear-gradient(135deg, ${C.b}, ${C.y})` : C.bd,
            color: symbol.trim() ? '#fff' : C.t3,
            fontSize: 13, fontWeight: 700, fontFamily: F,
            cursor: symbol.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          Analyze Setup
        </button>
      </div>

      {/* Results */}
      {result && (
        <div style={{
          background: C.sf,
          border: `1px solid ${C.bd}`,
          borderRadius: 14,
          padding: 20,
          marginBottom: 16,
        }}>
          {/* Confidence Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${confColor}15`,
              border: `2px solid ${confColor}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, fontFamily: F, color: confColor,
            }}>
              {result.score}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>
                {result.confidence.toUpperCase()} Confidence
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                {result.stats.sampleSize} similar trade{result.stats.sampleSize !== 1 ? 's' : ''} found • {result.stats.winRate}% WR
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: `${confColor}08`, border: `1px solid ${confColor}20`,
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, color: C.t2, fontFamily: M, lineHeight: 1.5 }}>
              {result.recommendation}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: '#FFCA28', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                ⚠️ Warnings
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: '#FFCA2808', border: '1px solid #FFCA2820',
                  marginBottom: 4,
                  fontSize: 11, color: C.t2, fontFamily: M, lineHeight: 1.4,
                }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Historical Matches */}
          {result.historicalMatches.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Similar Trades
              </div>
              {result.historicalMatches.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', borderRadius: 8,
                  background: `${C.t3}06`, marginBottom: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F }}>
                    {m.trade.symbol} {m.trade.side}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: M,
                    color: (m.trade.pnl || 0) >= 0 ? '#00E676' : '#EF5350',
                  }}>
                    {(m.trade.pnl || 0) >= 0 ? '+' : ''}{(m.trade.pnl || 0).toFixed(2)}
                  </span>
                  <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                    {Math.round(m.similarity)}% match
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Analyses */}
      {preTrades.length > 0 && !result && (
        <div style={{
          background: C.sf,
          border: `1px solid ${C.bd}`,
          borderRadius: 14,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 8 }}>
            RECENT ANALYSES
          </div>
          {preTrades.slice(0, 5).map((pt, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: i < 4 ? `1px solid ${C.bd}` : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
                {pt.setup?.symbol} {pt.setup?.side}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: M,
                padding: '2px 8px', borderRadius: 100,
                color: CONFIDENCE_COLORS[pt.confidence] || C.t3,
                background: `${CONFIDENCE_COLORS[pt.confidence] || C.t3}15`,
              }}>
                {pt.confidence}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          marginTop: 4, padding: '8px 10px', borderRadius: 8,
          border: `1px solid ${C.bd}`, background: C.bg,
          color: C.t1, fontSize: 13, fontFamily: F,
          outline: 'none',
        }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          marginTop: 4, padding: '8px 10px', borderRadius: 8,
          border: `1px solid ${C.bd}`, background: C.bg,
          color: C.t1, fontSize: 13, fontFamily: F,
          outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
