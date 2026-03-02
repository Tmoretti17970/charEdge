// ═══════════════════════════════════════════════════════════════════
// charEdge — No Data State Component (Phase 0.4)
// Displayed when no chart data is available — replaces fake OHLCV.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';

export default function NoDataState({ symbol, message }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      color: C.t3, fontFamily: F, textAlign: 'center', padding: 32,
      background: `radial-gradient(circle at center, ${C.sf}80 0%, transparent 70%)`,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: `${C.sf2}`, border: `1px solid ${C.bd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        📊
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: M, letterSpacing: '-0.02em' }}>
          NO DATA
        </span>
        {symbol && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.b, fontFamily: M }}>
            {symbol}
          </span>
        )}
      </div>
      <span style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 280, opacity: 0.8 }}>
        {message || 'Could not load data for this symbol. Check your network connection or try a different symbol.'}
      </span>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 8,
        background: `${C.y}15`, border: `1px solid ${C.y}30`,
        fontSize: 10, fontWeight: 600, fontFamily: M, color: C.y,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.y, animation: 'noDataPulse 2s ease-in-out infinite' }} />
        NO DATA
      </div>
      <style>{`@keyframes noDataPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}

export { NoDataState };
