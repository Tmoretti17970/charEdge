import { C, F } from '../constants.js';

// ─── Market Pulse Widgets ────────────────────────────────────────
import FearGreedWidget from '../app/components/social/FearGreedWidget.jsx';
import FundingRatesWidget from '../app/components/social/FundingRatesWidget.jsx';
import LiquidationTicker from '../app/components/social/LiquidationTicker.jsx';
import WhaleAlertWidget from '../app/components/social/WhaleAlertWidget.jsx';
import HeatmapWidget from '../app/components/social/HeatmapWidget.jsx';
import MacroCalendarWidget from '../app/components/social/MacroCalendarWidget.jsx';

export default function MarketsPage() {
  return (
    <div
      style={{
        padding: '28px 36px',
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            margin: '0 0 6px 0',
          }}
        >
          Markets Terminal
        </h1>
        <p
          style={{
            fontSize: 13,
            color: C.t2,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Quantitative data, on-chain signals, and macroeconomic indicators.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.3fr) minmax(280px, 1fr)',
          gap: 28,
          alignItems: 'start',
        }}
      >
        {/* Left: Macros & Sentiment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <FearGreedWidget />
          <MacroCalendarWidget />
        </div>

        {/* Center: On-chain signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <HeatmapWidget />
          <FundingRatesWidget />
          <LiquidationTicker />
        </div>

        {/* Right: Whale activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <WhaleAlertWidget />
        </div>
      </div>
    </div>
  );
}
