// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Section (Extracted from CommunityPage)
//
// Phase B Sprint 5: Supports inline (condensed) mode for unified feed.
// inline=true → compact 3-widget preview; inline=false → full view.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
// eslint-disable-next-line import/order
import { useDataStore } from '../../../state/useDataStore.js';

// ─── Market Intelligence Widgets ─────────────────────────────────
import FearGreedWidget from '../social/FearGreedWidget.jsx';
import FundingRatesWidget from '../social/FundingRatesWidget.jsx';
import HeatmapWidget from '../social/HeatmapWidget.jsx';
import LiquidationTicker from '../social/LiquidationTicker.jsx';
// eslint-disable-next-line import/order
import MacroCalendarWidget from '../social/MacroCalendarWidget.jsx';

// ─── Discover Components ─────────────────────────────────────────

// ─── Predictions ─────────────────────────────────────────────────
import PollCard from '../social/PollCard.jsx';
import TournamentPanel from '../social/TournamentPanel.jsx';
import TraderLeaderboard from '../social/TraderLeaderboard.jsx';
import WhaleAlertWidget from '../social/WhaleAlertWidget.jsx';
import XSentimentWidget from '../social/XSentimentWidget.jsx';
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

// ═════════════════════════════════════════════════════════════════
// Market Intel Content
// ═════════════════════════════════════════════════════════════════
function MarketIntelContent({ filter }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Row 1: Sentiment Overview — 2 equal columns */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <FearGreedWidget />
        <XSentimentWidget category={filter} />
      </div>

      {/* Row 2: Market Heatmap — full width */}
      <HeatmapWidget />

      {/* Row 3: Sector Rotation (Sprint 6) — full width */}
      <SectorRotationMap />

      {/* Row 4: Options Flow + Insider Tracker (Sprint 7 + 8) */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <OptionsFlowScanner />
        <InsiderTracker />
      </div>

      {/* Row 5: Analyst Consensus (Sprint 9) — full width */}
      <AnalystConsensus />

      {/* Row 6: Technical Scanner (Sprint 10) — full width */}
      <TechnicalScanner />

      {/* Row 7: Enhanced Calendar + Earnings (Sprint 4 + 5) */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <EconomicCalendarPro />
        <EarningsIntelligence />
      </div>

      {/* Row 8: Data Tables — 2 columns */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <FundingRatesWidget />
        <MacroCalendarWidget category={filter} />
      </div>

      {/* Row 9: Live Feeds — 2 columns */}
      <div className="tf-discover-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <WhaleAlertWidget />
        <LiquidationTicker />
      </div>

      {/* Row 10: Correlation Matrix (Sprint 11) — full width */}
      <CorrelationMatrix />

      {/* Row 11: Volatility Dashboard (Sprint 12) — full width */}
      <VolatilityDashboard />

      {/* Row 12: Multi-Timeframe Confluence (Sprint 14) — full width */}
      <ConfluenceView />

      {/* Row 13: Smart Alerts (Sprint 16) — full width */}
      <SmartAlerts />

      {/* Row 14: Social Validation (Sprint 19) — full width */}
      <SocialValidation />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Predictions Content
// ═════════════════════════════════════════════════════════════════
function PredictionsContent({ activePolls, resolvedPolls, onCreatePoll }) {
  const [subView, setSubView] = useState('predictions');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-nav: Predictions / Tournaments */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'predictions', label: '🔮 Prediction Markets' },
          { id: 'tournaments', label: '🏆 Tournaments' },
        ].map((tab) => {
          const isActive = subView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubView(tab.id)}
              style={{
                padding: '7px 18px', borderRadius: 10,
                border: `1px solid ${isActive ? C.b : C.bd}`,
                background: isActive ? alpha(C.b, 0.1) : 'transparent',
                color: isActive ? C.b : C.t2,
                fontSize: 12, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {subView === 'predictions' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Active Predictions Header + Create Button */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionHeader icon="🔮" title="Active Predictions" count={activePolls.length} />
              <button
                onClick={onCreatePoll}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: alpha(C.p, 0.12),
                  color: C.p,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: F,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.p, 0.2))}
                onMouseLeave={(e) => (e.currentTarget.style.background = alpha(C.p, 0.12))}
              >
                + Create Prediction
              </button>
            </div>
            {activePolls.length === 0 ? (
              <EmptyState text="No active prediction markets right now." icon="🔮" cta="Create one!" onCta={onCreatePoll} />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                  gap: 20,
                }}
              >
                {activePolls.map((p) => (
                  <PollCard key={p.id} pollId={p.id} compact={false} inFeed={false} />
                ))}
              </div>
            )}
          </div>

          {/* Resolved Predictions */}
          {resolvedPolls.length > 0 && (
            <div>
              <SectionHeader icon="✅" title="Resolved" count={resolvedPolls.length} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                  gap: 20,
                }}
              >
                {resolvedPolls.map((p) => (
                  <PollCard key={p.id} pollId={p.id} compact={false} inFeed={false} />
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div style={{ maxWidth: 480 }}>
            <SectionHeader icon="🏆" title="Prediction Accuracy Leaderboard" />
            <TraderLeaderboard />
          </div>
        </div>
      ) : (
        <TournamentPanel />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Combined Intel Section (Market Intel + Predictions)
// inline=true → compact preview for unified feed
// ═════════════════════════════════════════════════════════════════
export default function IntelSection({ activePolls, resolvedPolls, inline = false }) {
  const filter = useDataStore((s) => s.filter);
  const openCreatePoll = useDataStore((s) => s.openCreatePoll);
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
          <FearGreedWidget />
          <XSentimentWidget category={filter} />
        </div>
        <HeatmapWidget />
      </div>
    );
  }

  // Full mode: all intel + predictions
  return (
    <div role="tabpanel" aria-label="Market Intelligence" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <MarketIntelContent filter={filter} />
      <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 24 }}>
        <PredictionsContent
          activePolls={activePolls}
          resolvedPolls={resolvedPolls}
          onCreatePoll={openCreatePoll}
        />
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
