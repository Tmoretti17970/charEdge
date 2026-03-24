// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Copilot Panel (Sprint 23)
//
// Context-aware AI actions panel that surfaces intelligent
// suggestions based on user intent + NLP command input.
// ═══════════════════════════════════════════════════════════════════

import { useState, memo, useCallback } from 'react';
import { C } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { parseChartCommand, getContextualSuggestions } from '../../../charting_library/ai/AICopilotEngine.js';
import st from './MarketsCopilotPanel.module.css';

// ─── Intent mode styling ────────────────────────────────────────

const MODE_STYLES = {
  idle:      { label: 'Idle',      icon: '💤', color: '#888' },
  drawing:   { label: 'Drawing',   icon: '✏️', color: '#6e5ce6' },
  scalping:  { label: 'Scalping',  icon: '⚡', color: '#ff9f0a' },
  analysis:  { label: 'Analysis',  icon: '🔬', color: '#30d5c8' },
  trading:   { label: 'Trading',   icon: '📈', color: '#34c759' },
};

// ─── Component ──────────────────────────────────────────────────

function MarketsCopilotPanel() {
  const copilotPanelOpen = useMarketsPrefsStore((s) => s.copilotPanelOpen);
  const close = useMarketsPrefsStore((s) => s.setCopilotPanelOpen);
  const history = useMarketsPrefsStore((s) => s.copilotHistory) || [];
  const pushAction = useMarketsPrefsStore((s) => s.pushCopilotAction);

  const [input, setInput] = useState('');
  const [currentMode] = useState('idle');
  const [lastResult, setLastResult] = useState(null);

  const suggestions = getContextualSuggestions(currentMode);
  const modeStyle = MODE_STYLES[currentMode] || MODE_STYLES.idle;

  const executeCommand = useCallback((text) => {
    const result = parseChartCommand(text);
    if (result) {
      pushAction({ action: result.action, input: text, timestamp: Date.now() });
      setLastResult(result);
      // In a full integration, this would dispatch to the chart engine.
      // For now we record it in copilot history.
    } else {
      setLastResult({ action: 'unknown', payload: text });
    }
    setInput('');
  }, [pushAction]);

  if (!copilotPanelOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 340, zIndex: 910,
        background: C.bg,
        borderLeft: `1px solid ${C.bd}30`,
        display: 'flex', flexDirection: 'column',
        animation: 'copilot-slide-in 0.25s ease-out',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
      }}
    >
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.bd}20`,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--tf-font)', color: C.t1 }}>
            🤖 AI Copilot
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 8,
              fontSize: 8, fontWeight: 700, fontFamily: 'var(--tf-mono)',
              background: `${modeStyle.color}15`,
              color: modeStyle.color,
              border: `1px solid ${modeStyle.color}30`,
            }}>
              {modeStyle.icon} {modeStyle.label} Mode
            </span>
          </div>
        </div>
        <button
          onClick={() => close(false)}
          style={{
            background: `${C.bd}20`, border: 'none', borderRadius: radii.sm,
            color: C.t2, fontSize: 14, fontWeight: 600,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >×</button>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Suggested Actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => executeCommand(s.command)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: radii.sm,
                border: `1px solid ${C.bd}15`,
                background: 'transparent',
                color: C.t1,
                fontSize: 11, fontWeight: 600, fontFamily: 'var(--tf-font)',
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}12`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Last Result ───────────────────────────────────── */}
      {lastResult && (
        <div style={{
          margin: '0 16px 12px', padding: '8px 12px',
          borderRadius: radii.sm,
          background: lastResult.action === 'unknown' ? `${C.r}08` : `${C.g}08`,
          border: `1px solid ${lastResult.action === 'unknown' ? C.r : C.g}20`,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t3, marginBottom: 2 }}>
            {lastResult.action === 'unknown' ? '❌ Unrecognized' : '✅ Parsed'}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t2 }}>
            {lastResult.action}: {JSON.stringify(lastResult.payload || '')}
          </div>
        </div>
      )}

      {/* ── Command History ───────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          History
        </div>
        {history.length === 0 ? (
          <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3, fontStyle: 'italic' }}>
            No actions yet — try a command below
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...history].reverse().map((h, i) => (
              <div key={i} style={{
                padding: '6px 8px', borderRadius: 4,
                background: `${C.bd}06`,
                fontSize: 9, fontFamily: 'var(--tf-mono)', color: C.t2,
              }}>
                <span style={{ color: C.b, fontWeight: 700 }}>{h.action}</span>
                {' — '}
                <span style={{ color: C.t3 }}>{h.input}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── NLP Input ─────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px 16px',
        borderTop: `1px solid ${C.bd}20`,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) executeCommand(input.trim()); }}
            placeholder="Type a command..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: radii.sm,
              border: `1px solid ${C.bd}30`,
              background: `${C.bd}08`,
              color: C.t1,
              fontSize: 11, fontFamily: 'var(--tf-mono)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => { if (input.trim()) executeCommand(input.trim()); }}
            style={{
              padding: '8px 14px',
              borderRadius: radii.sm,
              border: 'none',
              background: C.b,
              color: '#fff',
              fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)',
              cursor: 'pointer',
            }}
          >
            Run
          </button>
        </div>
      </div>

      {/* ── Slide animation ───────────────────────────────── */}
      <style>{`
        @keyframes copilot-slide-in {
          from { transform: translateX(100%); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export { MarketsCopilotPanel };
export default memo(MarketsCopilotPanel);
