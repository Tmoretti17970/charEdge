// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Section (Extracted from CommunityPage)
//
// Phase B Sprint 5: Supports inline (condensed) mode for unified feed.
// inline=true → compact 3-widget preview; inline=false → full view.
//
// Social widgets (FearGreed, Sentiment, Heatmap, Polls, Tournaments,
// Leaderboard, WhaleAlert, Liquidation, FundingRates, MacroCalendar)
// quarantined — replaced with Coming Soon placeholders.
// Non-social discover components (AnalystConsensus, CorrelationMatrix,
// etc.) remain active.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
// eslint-disable-next-line import/order
import { useDataStore } from '../../../state/useDataStore.js';

// ─── Discover Components (non-social, still active) ─────────────
import AnalystConsensus from './AnalystConsensus.jsx';
import ConfluenceView from './ConfluenceView.jsx';
import CorrelationMatrix from './CorrelationMatrix.jsx';
import EarningsIntelligence from './EarningsIntelligence.jsx';
import EconomicCalendarPro from './EconomicCalendarPro.jsx';
import InsiderTracker from './InsiderTracker.jsx';
import OptionsFlowScanner from './OptionsFlowScanner.jsx';
import SectorRotationMap from './SectorRotationMap.jsx';
import SmartAlerts from './SmartAlerts.jsx';
import SocialValidation from './SocialValidation.jsx';
import TechnicalScanner from './TechnicalScanner.jsx';
import VolatilityDashboard from './VolatilityDashboard.jsx';
import { alpha } from '@/shared/colorUtils';

// Social widgets quarantined — see src/_quarantine/p2p/README.md

// ═════════════════════════════════════════════════════════════════
// Coming Soon Placeholder (replaces quarantined social widgets)
// ═════════════════════════════════════════════════════════════════
function ComingSoonWidget({ icon, title }) {
  return (
    <div
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        background: C.bg2,
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 28, opacity: 0.7 }}>{icon}</span>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t2, fontFamily: F }}>{title}</div>
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 16,
          background: alpha(C.b, 0.08),
          color: C.b,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: F,
        }}
      >
        Coming Soon
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Market Intel Content
// ═════════════════════════════════════════════════════════════════
function MarketIntelContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Row 1: Sentiment Overview — placeholders for quarantined widgets */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ComingSoonWidget icon="😨" title="Fear & Greed Index" />
        <ComingSoonWidget icon="𝕏" title="Social Sentiment" />
      </div>

      {/* Row 2: Market Heatmap — placeholder */}
      <ComingSoonWidget icon="🗺️" title="Market Heatmap" />

      {/* Row 3: Sector Rotation — active (non-social) */}
      <SectorRotationMap />

      {/* Row 4: Options Flow + Insider Tracker — active */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <OptionsFlowScanner />
        <InsiderTracker />
      </div>

      {/* Row 5: Analyst Consensus — active */}
      <AnalystConsensus />

      {/* Row 6: Technical Scanner — active */}
      <TechnicalScanner />

      {/* Row 7: Calendar + Earnings — active */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <EconomicCalendarPro />
        <EarningsIntelligence />
      </div>

      {/* Row 8: Data Tables — placeholders for quarantined widgets */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ComingSoonWidget icon="💰" title="Funding Rates" />
        <ComingSoonWidget icon="📅" title="Macro Calendar" />
      </div>

      {/* Row 9: Live Feeds — placeholders for quarantined widgets */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ComingSoonWidget icon="🐋" title="Whale Alerts" />
        <ComingSoonWidget icon="💧" title="Liquidation Tracker" />
      </div>

      {/* Row 10: Correlation Matrix — active */}
      <CorrelationMatrix />

      {/* Row 11: Volatility Dashboard — active */}
      <VolatilityDashboard />

      {/* Row 12: Confluence — active */}
      <ConfluenceView />

      {/* Row 13: Smart Alerts — active */}
      <SmartAlerts />

      {/* Row 14: Social Validation — active */}
      <SocialValidation />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Predictions Content (quarantined — all social)
// ═════════════════════════════════════════════════════════════════
function PredictionsContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader icon="🔮" title="Predictions & Tournaments" />
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        <ComingSoonWidget icon="🔮" title="Prediction Markets" />
        <ComingSoonWidget icon="🏆" title="Trading Tournaments" />
        <ComingSoonWidget icon="🏅" title="Trader Leaderboard" />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Combined Intel Section (Market Intel + Predictions)
// inline=true → compact preview for unified feed
// ═════════════════════════════════════════════════════════════════
function IntelSection({ activePolls, resolvedPolls, inline = false }) {
  const setActiveChip = useDataStore((s) => s.setActiveChip);

  // Inline mode: show condensed 3-widget preview
  if (inline) {
    return (
      <div
        role="region"
        aria-label="Market Intelligence Preview"
        style={{
          display: 'flex', flexDirection: 'column', gap: 16,
          padding: 20,
          background: alpha(C.sf, 0.3),
          borderRadius: 16,
          border: `1px solid ${C.bd}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionHeader icon="📊" title="Market Intelligence" />
          <button
            onClick={() => setActiveChip('intel')}
            style={{
              padding: '5px 14px', borderRadius: 8, border: `1px solid ${C.bd}`,
              background: 'transparent', color: C.b, fontSize: 11,
              fontWeight: 700, fontFamily: F, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            View All →
          </button>
        </div>
        <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ComingSoonWidget icon="😨" title="Fear & Greed Index" />
          <ComingSoonWidget icon="𝕏" title="Social Sentiment" />
        </div>
        <ComingSoonWidget icon="🗺️" title="Market Heatmap" />
      </div>
    );
  }

  // Full mode: all intel + predictions
  return (
    <div role="tabpanel" aria-label="Market Intelligence" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <MarketIntelContent />
      <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 24 }}>
        <PredictionsContent />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Shared Components
// ═════════════════════════════════════════════════════════════════

function SectionHeader({ icon, title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: C.t1,
          fontFamily: F,
        }}
      >
        {title}
      </h2>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.t3,
            background: alpha(C.t3, 0.1),
            padding: '3px 8px',
            borderRadius: 6,
            fontFamily: M,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ text, icon, cta, onCta }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: C.bg2,
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
      }}
    >
      {icon && <div className="tf-empty-float" style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>}
      <div style={{ color: C.t3, fontSize: 14, fontFamily: F, marginBottom: cta ? 16 : 0 }}>{text}</div>
      {cta && onCta && (
        <button
          onClick={onCta}
          style={{
            padding: '8px 20px', borderRadius: 10, border: 'none',
            background: C.b, color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: F,
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export { IntelSection, SectionHeader, EmptyState };

export default React.memo(IntelSection);
