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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        position: 'relative',
        height: '100%',
      }}
    >
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
    <div
      className="tf-skel-toolbar"
      style={{
        height: 40,
        minHeight: 40,
        borderBottom: '1px solid var(--tf-bd, #2a2e3a)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
      }}
    >
      {/* Symbol pill */}
      <div className="tf-skeleton" style={{ width: 64, height: 20, borderRadius: 6 }} />
      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'var(--tf-bd, #2a2e3a)', opacity: 0.3 }} />
      {/* Timeframe pills */}
      {[28, 24, 24, 28, 24, 28].map((w, i) => (
        <div
          key={i}
          className="tf-skeleton"
          style={{ width: w, height: 18, borderRadius: 5, animationDelay: `${i * 0.04}s` }}
        />
      ))}
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      {/* Right buttons */}
      <div className="tf-skeleton" style={{ width: 24, height: 20, borderRadius: 6 }} />
      <div className="tf-skeleton" style={{ width: 24, height: 20, borderRadius: 6, animationDelay: '0.1s' }} />
    </div>
  );
});

// ─── Indicator Pane Skeleton ──────────────────────────────────────
const IndicatorPaneSkeleton = memo(function IndicatorPaneSkeleton() {
  return (
    <div
      className="tf-skel-indicators"
      style={{
        height: 80,
        borderTop: '1px solid var(--tf-bd, #2a2e3a)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Simulated indicator line */}
      <svg width="100%" height="40" viewBox="0 0 400 40" preserveAspectRatio="none" style={{ opacity: 0.15 }}>
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
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, borderLeft: '1px solid var(--tf-bd, #2a2e3a)', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="tf-skeleton" style={{ width: 28, height: 6, borderRadius: 3, animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
    </div>
  );
});

// ─── Panel Skeleton (for slide-in panels) ─────────────────────────
const PanelSkeleton = memo(function PanelSkeleton() {
  return (
    <div
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      role="progressbar"
      aria-label="Loading panel"
    >
      {/* Header */}
      <div className="tf-skeleton" style={{ width: '60%', height: 14, borderRadius: 4 }} />
      {/* Content rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <div className="tf-skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, animationDelay: `${i * 0.06}s` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <div className="tf-skeleton" style={{ width: '80%', height: 10, borderRadius: 3, animationDelay: `${i * 0.06 + 0.02}s` }} />
            <div className="tf-skeleton" style={{ width: '50%', height: 8, borderRadius: 3, animationDelay: `${i * 0.06 + 0.04}s` }} />
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Mini Skeleton (for compact widgets) ──────────────────────────
const MiniSkeleton = memo(function MiniSkeleton() {
  return (
    <div
      style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
      role="progressbar"
      aria-label="Loading widget"
    >
      <div className="tf-skeleton" style={{ width: '40%', height: 10, borderRadius: 3 }} />
      <div className="tf-skeleton" style={{ width: '100%', height: 40, borderRadius: 6, animationDelay: '0.05s' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="tf-skeleton" style={{ flex: 1, height: 8, borderRadius: 3, animationDelay: '0.1s' }} />
        <div className="tf-skeleton" style={{ flex: 1, height: 8, borderRadius: 3, animationDelay: '0.15s' }} />
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
      className={phaseClass}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--tf-bg, #08090a)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
      role="progressbar"
      aria-busy="true"
      aria-label="Loading chart data"
    >
      {/* Toolbar skeleton (always shown) */}
      <ToolbarSkeleton />

      {/* Main charting area */}
      <div style={{ flex: 1, position: 'relative', borderBottom: '1px solid var(--tf-bd, #2a2e3a)' }}>
        {/* Dashed grid lines */}
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={`h${pct}`}
            style={{
              position: 'absolute',
              top: `${pct}%`,
              left: 0,
              right: 60,
              height: 0,
              borderTop: '1px dashed var(--tf-bd, #2a2e3a)',
              opacity: 0.2,
            }}
          />
        ))}
        {[15, 30, 45, 60, 75, 90].map((pct) => (
          <div
            key={`v${pct}`}
            style={{
              position: 'absolute',
              left: `${pct * 0.93}%`,
              top: 0,
              bottom: 0,
              width: 0,
              borderLeft: '1px dashed var(--tf-bd, #2a2e3a)',
              opacity: 0.15,
            }}
          />
        ))}

        {/* Candle skeletons */}
        {showCandles && (
          <div
            className="tf-skel-candles"
            style={{
              position: 'absolute',
              left: '5%',
              right: 68,
              top: 0,
              bottom: 0,
              display: 'flex',
              gap: 2,
              padding: '10% 0',
            }}
          >
            {CANDLE_PATTERN.map((candle, i) => (
              <CandleSkeleton key={i} candle={candle} index={i} />
            ))}
          </div>
        )}

        {/* Center loading indicator (only in phase 0) */}
        {showSpinner && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 'calc(50% - 30px)',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.4s ease',
            }}
          >
            <div
              className="tf-spin"
              style={{
                width: 18,
                height: 18,
                border: '2px solid var(--tf-bd, #2a2e3a)',
                borderTop: '2px solid var(--tf-accent, #e8642c)',
                borderRadius: '50%',
              }}
            />
            <span
              style={{
                color: 'var(--tf-t3, #7078a0)',
                fontSize: 11,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.5px',
              }}
            >
              Loading chart…
            </span>
          </div>
        )}

        {/* Price axis */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 60,
            borderLeft: '1px solid var(--tf-bd, #2a2e3a)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="tf-skeleton"
              style={{
                width: 36,
                height: 8,
                borderRadius: 4,
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Indicator pane skeleton (phase 0 or 3+) */}
      {showIndicators && <IndicatorPaneSkeleton />}

      {/* Time axis */}
      <div style={{ height: 24, display: 'flex', borderBottom: '1px solid var(--tf-bd, #2a2e3a)' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}
        >
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="tf-skeleton"
              style={{
                width: 28,
                height: 6,
                borderRadius: 3,
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </div>
        <div style={{ width: 60, borderLeft: '1px solid var(--tf-bd, #2a2e3a)' }} />
      </div>
    </div>
  );
});
