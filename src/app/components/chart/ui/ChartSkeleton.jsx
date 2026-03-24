// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Skeleton (Content-Aware, Phased)
//
// Visual skeleton that mimics actual chart structure with phased loading:
//   Phase 0: Full skeleton (toolbar + candles + axes + loading spinner)
//   Phase 1: Toolbar skeleton only (quick first paint)
//   Phase 2: Toolbar + candle skeletons (data arriving)
//   Phase 3: Full skeleton with indicator panes
//
// Variants:
//   "chart"  — default full chart skeleton
//   "panel"  — narrow panel skeleton for slide-in panels
//   "mini"   — compact skeleton for widgets
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import s from './ChartSkeleton.module.css';

// Deterministic "random" candle heights for consistent skeleton appearance
const CANDLE_PATTERN = [
  { body: 45, wick: 12, y: 35, bullish: true },
  { body: 30, wick: 8, y: 40, bullish: false },
  { body: 55, wick: 15, y: 28, bullish: true },
  { body: 25, wick: 10, y: 45, bullish: false },
  { body: 40, wick: 14, y: 32, bullish: true },
  { body: 35, wick: 9, y: 38, bullish: true },
  { body: 50, wick: 13, y: 30, bullish: false },
  { body: 28, wick: 7, y: 42, bullish: true },
  { body: 60, wick: 16, y: 25, bullish: true },
  { body: 38, wick: 11, y: 36, bullish: false },
  { body: 42, wick: 10, y: 34, bullish: true },
  { body: 20, wick: 6, y: 48, bullish: false },
  { body: 52, wick: 14, y: 27, bullish: true },
  { body: 32, wick: 9, y: 40, bullish: true },
  { body: 45, wick: 12, y: 33, bullish: false },
  { body: 38, wick: 10, y: 36, bullish: true },
];

const CandleSkeleton = memo(function CandleSkeleton({ candle, index }) {
  const opacity = 0.15 + (index % 3) * 0.05;
  return (
    <div className={s.candleWrap}>
      {/* Wick */}
      <div
        style={{
          position: 'absolute',
          top: `${candle.y - candle.wick / 2}%`,
          width: 1,
          height: `${candle.body + candle.wick}%`,
          background: 'var(--tf-bd, #2a2e3a)',
          opacity: opacity * 0.7,
        }}
      />
      {/* Body */}
      <div
        className="tf-skeleton"
        style={{
          position: 'absolute',
          top: `${candle.y}%`,
          width: '60%',
          maxWidth: 10,
          height: `${candle.body * 0.6}%`,
          borderRadius: 2,
          opacity,
          animationDelay: `${index * 0.05}s`,
        }}
      />
    </div>
  );
});

// ─── Toolbar Skeleton ─────────────────────────────────────────────
const ToolbarSkeleton = memo(function ToolbarSkeleton() {
  return (
    <div className={s.toolbar}>
      {/* Symbol pill */}
      <div className={`tf-skeleton ${s.skelSymbol}`} />
      {/* Divider */}
      <div className={s.toolbarDivider} />
      {/* Timeframe pills */}
      {[28, 24, 24, 28, 24, 28].map((w, i) => (
        <div
          key={i}
          className={`tf-skeleton ${s.skelTf}`}
          style={{ width: w, '--d': `${i * 0.04}s` }}
        />
      ))}
      {/* Spacer */}
      <div className={s.toolbarSpacer} />
      {/* Right buttons */}
      <div className={`tf-skeleton ${s.skelRightBtn}`} />
      <div className={`tf-skeleton ${s.skelRightBtn}`} style={{ '--d': '0.1s' }} />
    </div>
  );
});

// ─── Indicator Pane Skeleton ──────────────────────────────────────
const IndicatorPaneSkeleton = memo(function IndicatorPaneSkeleton() {
  return (
    <div className={s.indicatorPane}>
      {/* Simulated indicator line */}
      <svg width="100%" height="40" viewBox="0 0 400 40" preserveAspectRatio="none" className={s.indicatorSvg}>
        <polyline
          points="0,30 30,22 60,28 90,15 120,20 150,10 180,18 210,12 240,25 270,8 300,20 330,15 360,22 400,18"
          fill="none"
          stroke="var(--tf-accent, #e8642c)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Y-axis labels */}
      <div className={s.indicatorYAxis}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`tf-skeleton ${s.skelIndicatorTick}`} style={{ '--d': `${i * 0.05}s` }} />
        ))}
      </div>
    </div>
  );
});

// ─── Panel Skeleton (for slide-in panels) ─────────────────────────
const PanelSkeleton = memo(function PanelSkeleton() {
  return (
    <div className={s.panel} role="progressbar" aria-label="Loading panel">
      {/* Header */}
      <div className={`tf-skeleton ${s.skelPanelHeader}`} />
      {/* Content rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className={s.panelRow}>
          <div className={`tf-skeleton ${s.skelPanelIcon}`} style={{ '--d': `${i * 0.06}s` }} />
          <div className={s.panelTextCol}>
            <div className={`tf-skeleton ${s.skelPanelLine}`} style={{ width: '80%', '--d': `${i * 0.06 + 0.02}s` }} />
            <div className={`tf-skeleton ${s.skelPanelSub}`} style={{ width: '50%', '--d': `${i * 0.06 + 0.04}s` }} />
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Mini Skeleton (for compact widgets) ──────────────────────────
const MiniSkeleton = memo(function MiniSkeleton() {
  return (
    <div className={s.mini} role="progressbar" aria-label="Loading widget">
      <div className={`tf-skeleton ${s.skelMiniLabel}`} />
      <div className={`tf-skeleton ${s.skelMiniBar}`} />
      <div className={s.miniRow}>
        <div className={`tf-skeleton ${s.skelMiniFlex}`} style={{ '--d': '0.1s' }} />
        <div className={`tf-skeleton ${s.skelMiniFlex}`} style={{ '--d': '0.15s' }} />
      </div>
    </div>
  );
});

// ─── Main Chart Skeleton ──────────────────────────────────────────
export default memo(function ChartSkeleton({ phase = 0, variant = 'chart' }) {
  // Non-chart variants
  if (variant === 'panel') return <PanelSkeleton />;
  if (variant === 'mini') return <MiniSkeleton />;

  const phaseClass = phase > 0 ? `tf-skeleton-phase-${phase}` : '';
  const showCandles = phase === 0 || phase >= 2;
  const showIndicators = phase === 0 || phase >= 3;
  const showSpinner = phase === 0;

  return (
    <div
      className={`${phaseClass} ${s.root}`}
      role="progressbar"
      aria-busy="true"
      aria-label="Loading chart data"
    >
      {/* Toolbar skeleton (always shown) */}
      <ToolbarSkeleton />

      {/* Main charting area */}
      <div className={s.chartArea}>
        {/* Dashed grid lines */}
        {[20, 40, 60, 80].map((pct) => (
          <div key={`h${pct}`} className={s.hGrid} style={{ top: `${pct}%` }} />
        ))}
        {[15, 30, 45, 60, 75, 90].map((pct) => (
          <div key={`v${pct}`} className={s.vGrid} style={{ left: `${pct * 0.93}%` }} />
        ))}

        {/* Candle skeletons */}
        {showCandles && (
          <div className={s.candleContainer}>
            {CANDLE_PATTERN.map((candle, i) => (
              <CandleSkeleton key={i} candle={candle} index={i} />
            ))}
          </div>
        )}

        {/* Center loading indicator (only in phase 0) */}
        {showSpinner && (
          <div className={s.spinnerWrap}>
            <div className={`tf-spin ${s.spinner}`} />
            <span className={s.spinnerText}>Loading chart…</span>
          </div>
        )}

        {/* Price axis */}
        <div className={s.priceAxis}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`tf-skeleton ${s.skelPriceTick}`}
              style={{ '--d': `${i * 0.06}s` }}
            />
          ))}
        </div>
      </div>

      {/* Indicator pane skeleton (phase 0 or 3+) */}
      {showIndicators && <IndicatorPaneSkeleton />}

      {/* Time axis */}
      <div className={s.timeAxis}>
        <div className={s.timeAxisLabels}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`tf-skeleton ${s.skelTimeTick}`}
              style={{ '--d': `${i * 0.04}s` }}
            />
          ))}
        </div>
        <div className={s.timeAxisCap} />
      </div>
    </div>
  );
});
