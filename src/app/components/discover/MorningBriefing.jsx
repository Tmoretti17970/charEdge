// ═══════════════════════════════════════════════════════════════════
// charEdge — Morning Briefing Component
//
// Personalized, narrative-style daily briefing for the Discover tab.
// 5 collapsible sections:
//   1. Watchlist Digest — price, levels, patterns, news for your symbols
//   2. Overnight Movers — top gainers/losers across markets
//   3. Economic Calendar — today's events ranked by impact
//   4. Sentiment Snapshot — Fear & Greed + social sentiment
//   5. Your Edge Today — insights from your trading journal
//
// Decomposed: sub-components live in ./morning-briefing/.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useBriefingStore } from '../../../state/useBriefingStore.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
// eslint-disable-next-line import/order
import LabsBadge from '../ui/LabsBadge.jsx';

// Extracted sub-modules
import BriefingSection from './morning-briefing/BriefingSection.jsx';
import BriefingSkeleton from './morning-briefing/BriefingSkeleton.jsx';
import EdgeInsights from './morning-briefing/EdgeInsights.jsx';
import EventsToday from './morning-briefing/EventsToday.jsx';
import OvernightMovers from './morning-briefing/OvernightMovers.jsx';
import SentimentSnapshot from './morning-briefing/SentimentSnapshot.jsx';
import WatchlistDigest from './morning-briefing/WatchlistDigest.jsx';
import { fetchBriefingData } from '@/journal/briefingService.js';
import { alpha } from '@/shared/colorUtils';

export default function MorningBriefing() {
  const watchlistItems = useWatchlistStore((s) => s.items);
  const trades = useJournalStore((s) => s.trades);
  const briefing = useBriefingStore((s) => s.briefing);
  const loading = useBriefingStore((s) => s.loading);
  const dismissed = useBriefingStore((s) => s.dismissed);
  const expandedSections = useBriefingStore((s) => s.expandedSections);
  const setBriefing = useBriefingStore((s) => s.setBriefing);
  const setLoading = useBriefingStore((s) => s.setLoading);
  const dismiss = useBriefingStore((s) => s.dismiss);
  const toggleSection = useBriefingStore((s) => s.toggleSection);
  const isStale = useBriefingStore((s) => s.isStale);

  // Fetch briefing on mount or when stale
  useEffect(() => {
    if (!briefing || isStale()) {
      setLoading(true);
      fetchBriefingData({ watchlistSymbols: watchlistItems, trades }).then(setBriefing);
    }
  }, [watchlistItems.length]); // eslint-disable-line

  if (dismissed) {
    return (
      <button
        onClick={() => useBriefingStore.getState().undismiss()}
        className="tf-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: alpha(C.b, 0.06),
          border: `1px solid ${alpha(C.b, 0.15)}`,
          borderRadius: 12,
          color: C.b,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: F,
          marginBottom: 20,
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: 16 }}>🌅</span>
        Show Morning Briefing
      </button>
    );
  }

  if (loading || !briefing) {
    return <BriefingSkeleton />;
  }

  return (
    <div
      className="tf-briefing"
      style={{
        background: `linear-gradient(135deg, ${alpha(C.b, 0.04)}, ${alpha(C.p, 0.03)})`,
        border: `1px solid ${alpha(C.b, 0.12)}`,
        borderRadius: 18,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* ─── Header ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '20px 24px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🌅</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: F }}>
              {briefing.greeting}, Trader
            </h2>
            <LabsBadge />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: C.t3,
                background: alpha(C.t3, 0.1),
                padding: '3px 8px',
                borderRadius: 6,
                fontFamily: M,
              }}
            >
              ~{briefing.readTimeMinutes} min read
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.t2, fontFamily: F, lineHeight: 1.6, maxWidth: 600 }}>
            {briefing.marketNarrative}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              setLoading(true);
              fetchBriefingData({ watchlistSymbols: watchlistItems, trades }).then(setBriefing);
            }}
            className="tf-btn"
            title="Refresh briefing"
            style={{
              background: 'transparent',
              border: `1px solid ${C.bd}`,
              borderRadius: 8,
              padding: '5px 8px',
              cursor: 'pointer',
              color: C.t3,
              fontSize: 14,
              transition: 'all 0.15s',
            }}
          >
            ↻
          </button>
          <button
            onClick={dismiss}
            className="tf-btn"
            title="Dismiss briefing"
            style={{
              background: 'transparent',
              border: `1px solid ${C.bd}`,
              borderRadius: 8,
              padding: '5px 8px',
              cursor: 'pointer',
              color: C.t3,
              fontSize: 12,
              transition: 'all 0.15s',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Sections ────────────────────────────────────────── */}
      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <BriefingSection id="watchlist" title="Your Watchlist" icon="🎯" count={briefing.watchlistDigest.length} expanded={expandedSections.watchlist} onToggle={() => toggleSection('watchlist')}>
          <WatchlistDigest items={briefing.watchlistDigest} />
        </BriefingSection>

        <BriefingSection id="movers" title="Overnight Movers" icon="📈" expanded={expandedSections.movers} onToggle={() => toggleSection('movers')}>
          <OvernightMovers movers={briefing.overnightMovers} />
        </BriefingSection>

        <BriefingSection id="events" title="Economic Calendar" icon="📅" count={briefing.eventsToday.length} expanded={expandedSections.events} onToggle={() => toggleSection('events')}>
          <EventsToday events={briefing.eventsToday} />
        </BriefingSection>

        <BriefingSection id="sentiment" title="Sentiment Snapshot" icon="🌡️" expanded={expandedSections.sentiment} onToggle={() => toggleSection('sentiment')}>
          <SentimentSnapshot data={briefing.sentiment} />
        </BriefingSection>

        {briefing.edgeInsights.length > 0 && (
          <BriefingSection id="edge" title="Your Edge Today" icon="⚡" expanded={expandedSections.edge} onToggle={() => toggleSection('edge')} accent>
            <EdgeInsights insights={briefing.edgeInsights} />
          </BriefingSection>
        )}
      </div>
    </div>
  );
}

export { MorningBriefing };
