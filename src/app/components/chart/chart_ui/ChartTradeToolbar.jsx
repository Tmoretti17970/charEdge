// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Chart Trade Toolbar
// Sprint 10 C10.7: Trade-related buttons for the chart toolbar.
// Long/Short entry — compact TradingView-style colored badge pills.
// ═══════════════════════════════════════════════════════════════════

import { useChartStore } from '../../../../state/useChartStore.js';
import { C, M } from '../../../../constants.js';

export default function ChartTradeToolbar() {
  const {
    tradeMode,
    enterTradeMode,
    exitTradeMode,
  } = useChartStore();

  const isLong = tradeMode === 'long';
  const isShort = tradeMode === 'short';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Long */}
      <button
        className="tf-trade-pill"
        data-side="long"
        data-active={isLong || undefined}
        onClick={() => (isLong ? exitTradeMode() : enterTradeMode('long'))}
        title="Enter long trade (click chart to set entry)"
      >
        <span className="tf-trade-dot" style={{ background: C.g }} />
        L
      </button>

      {/* Short */}
      <button
        className="tf-trade-pill"
        data-side="short"
        data-active={isShort || undefined}
        onClick={() => (isShort ? exitTradeMode() : enterTradeMode('short'))}
        title="Enter short trade (click chart to set entry)"
      >
        <span className="tf-trade-dot" style={{ background: C.r }} />
        S
      </button>
    </div>
  );
}
