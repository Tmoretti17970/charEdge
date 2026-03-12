// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Chart Trade Toolbar
// Sprint 10 C10.7: Trade-related buttons for the chart toolbar.
// Long/Short entry — compact TradingView-style colored badge pills.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../../../constants.js';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';

export default function ChartTradeToolbar() {
  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const tradeSide = useChartFeaturesStore((s) => s.tradeSide);
  const enterTradeMode = useChartTradeStore((s) => s.enterTradeMode);
  const exitTradeMode = useChartFeaturesStore((s) => s.exitTradeMode);

  const isLong = tradeMode && tradeSide === 'long';
  const isShort = tradeMode && tradeSide === 'short';

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
