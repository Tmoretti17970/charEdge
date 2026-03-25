// ═══════════════════════════════════════════════════════════════════
// charEdge — TheBrief (Intel Hero Card)
//
// Glassmorphism hero card for the AI morning briefing on the Intel page.
// Features:
//   - Time-aware greeting with formatted date
//   - Bloomberg-style market narrative (rule-based, personalized)
//   - Key stats row: event count, watchlist trend, regime badge
//   - Collapsible full briefing with 5 sub-sections
//   - "Ask Copilot" CTA
//   - Premium stagger entrance animation
//   - Loading skeleton state
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import { useBriefingStore } from '../../../state/useBriefingStore.ts';
import { useJournalStore } from '../../../state/useJournalStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import BriefingSection from '../discover/morning-briefing/BriefingSection.jsx';
import BriefingSkeleton from '../discover/morning-briefing/BriefingSkeleton.jsx';
import EdgeInsights from '../discover/morning-briefing/EdgeInsights.jsx';
import EventsToday from '../discover/morning-briefing/EventsToday.jsx';
import OvernightMovers from '../discover/morning-briefing/OvernightMovers.jsx';
import SentimentSnapshot from '../discover/morning-briefing/SentimentSnapshot.jsx';
import WatchlistDigest from '../discover/morning-briefing/WatchlistDigest.jsx';
import { fetchBriefingData } from '@/journal/briefingService.js';
import { alpha } from '@/shared/colorUtils';

// ─── Helpers ──────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generates a concise, Bloomberg-style narrative from briefing data,
 * personalized with the user's watchlist and trade history.
 */
function generateNarrative(briefing, watchlistItems, trades) {
  if (!briefing) return '';

  const { sentiment, overnightMovers, eventsToday, watchlistDigest, edgeInsights: _edgeInsights } = briefing;

  // Determine regime
  const _regime = deriveRegime(sentiment, overnightMovers);

  // Watchlist trend summary
  const wlUp = (watchlistDigest || []).filter((w) => w.change > 0).length;
  const wlDown = (watchlistDigest || []).filter((w) => w.change < 0).length;
  const topMover = (watchlistDigest || []).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];

  // Trade context
  const recentTrades = (trades || []).slice(0, 20);
  const wins = recentTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = recentTrades.length > 0 ? Math.round((wins / recentTrades.length) * 100) : null;

  // Build sentences
  const sentences = [];

  // Sentence 1: Market tone
  if (sentiment && sentiment.fearGreed >= 70) {
    sentences.push(
      `Markets are firmly risk-on with sentiment at ${sentiment.fearGreed} (${sentiment.fearGreedLabel}) — momentum is elevated but overextension risk is building.`,
    );
  } else if (sentiment && sentiment.fearGreed >= 50) {
    sentences.push(
      `Sentiment reads ${sentiment.fearGreed} (${sentiment.fearGreedLabel}) — markets are cautiously constructive with selective rotation underway.`,
    );
  } else if (sentiment && sentiment.fearGreed >= 30) {
    sentences.push(
      `Sentiment sits at ${sentiment.fearGreed} (${sentiment.fearGreedLabel}) — uncertainty dominates and conviction setups are scarce.`,
    );
  } else if (sentiment) {
    sentences.push(
      `Fear is running the tape at ${sentiment.fearGreed} — contrarian setups are forming but discipline is paramount.`,
    );
  }

  // Sentence 2: Watchlist + movers context
  if (topMover && watchlistDigest.length > 0) {
    const direction = topMover.change > 0 ? 'leading' : 'dragging';
    sentences.push(
      `${topMover.symbol} is ${direction} your watchlist at ${topMover.change > 0 ? '+' : ''}${topMover.change.toFixed(1)}%, with ${wlUp} name${wlUp !== 1 ? 's' : ''} green and ${wlDown} red.`,
    );
  } else if (overnightMovers && overnightMovers.length > 0) {
    const top = overnightMovers[0];
    sentences.push(`Overnight, ${top.symbol} led movers at ${top.change > 0 ? '+' : ''}${top.change.toFixed(1)}%.`);
  }

  // Sentence 3: Events or personal edge
  const highImpact = (eventsToday || []).filter((e) => e.impact === 'high');
  if (highImpact.length > 0 && winRate !== null) {
    sentences.push(
      `${highImpact.length} high-impact event${highImpact.length > 1 ? 's' : ''} on the calendar today — your recent ${winRate}% win rate suggests ${winRate >= 55 ? 'staying aggressive on A+ setups' : 'tightening risk management'}.`,
    );
  } else if (highImpact.length > 0) {
    sentences.push(
      `Watch for ${highImpact.length} high-impact event${highImpact.length > 1 ? 's' : ''} today — volatility could spike around the releases.`,
    );
  } else if (winRate !== null) {
    sentences.push(
      `Your recent ${winRate}% win rate over ${recentTrades.length} trades ${winRate >= 55 ? 'shows edge — press your setups' : 'calls for selectivity — wait for confluence'}.`,
    );
  }

  return sentences.join(' ');
}

function deriveRegime(sentiment, movers) {
  if (!sentiment) return 'Choppy';
  const fg = sentiment.fearGreed;
  const upMovers = (movers || []).filter((m) => m.change > 0).length;
  const downMovers = (movers || []).length - upMovers;

  if (fg >= 60 && upMovers > downMovers) return 'Risk-On';
  if (fg <= 40 && downMovers > upMovers) return 'Risk-Off';
  return 'Choppy';
}

function getRegimeColor(regime) {
  if (regime === 'Risk-On') return C.g;
  if (regime === 'Risk-Off') return C.r;
  return C.b;
}

// ─── Stagger Animation Keyframes (injected once) ──────────────────

const KEYFRAME_ID = 'tf-brief-stagger';

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes tfBriefFadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tfBriefShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────

function TheBrief() {
  const watchlistItems = useWatchlistStore((s) => s.items);
  const trades = useJournalStore((s) => s.trades);
  const briefing = useBriefingStore((s) => s.briefing);
  const loading = useBriefingStore((s) => s.loading);
  const expandedSections = useBriefingStore((s) => s.expandedSections);
  const setBriefing = useBriefingStore((s) => s.setBriefing);
  const setLoading = useBriefingStore((s) => s.setLoading);
  const toggleSection = useBriefingStore((s) => s.toggleSection);
  const isStale = useBriefingStore((s) => s.isStale);

  const [expanded, setExpanded] = useState(false);

  // Inject keyframes
  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Fetch briefing on mount or when stale
  useEffect(() => {
    if (!briefing || isStale()) {
      setLoading(true);
      fetchBriefingData({ watchlistSymbols: watchlistItems, trades }).then(setBriefing);
    }
  }, [watchlistItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const narrative = useMemo(
    () => generateNarrative(briefing, watchlistItems, trades),
    [briefing, watchlistItems, trades],
  );

  const regime = useMemo(
    () => (briefing ? deriveRegime(briefing.sentiment, briefing.overnightMovers) : null),
    [briefing],
  );

  const highImpactCount = useMemo(
    () => (briefing ? (briefing.eventsToday || []).filter((e) => e.impact === 'high').length : 0),
    [briefing],
  );

  const watchlistTrendLabel = useMemo(() => {
    if (!briefing || !briefing.watchlistDigest || briefing.watchlistDigest.length === 0) return null;
    const up = briefing.watchlistDigest.filter((w) => w.change > 0).length;
    const total = briefing.watchlistDigest.length;
    if (up > total * 0.65) return 'Mostly Green';
    if (up < total * 0.35) return 'Mostly Red';
    return 'Mixed';
  }, [briefing]);

  const handleToggleExpand = useCallback(() => setExpanded((p) => !p), []);

  // ─── Loading State ──────────────────────────────────────────────
  if (loading || !briefing) {
    return <BriefingSkeleton />;
  }

  const regimeColor = getRegimeColor(regime);

  // Stagger helper
  const stagger = (index) => ({
    animation: 'tfBriefFadeUp 0.5s ease both',
    animationDelay: `${index * 80}ms`,
  });

  return (
    <div
      style={{
        position: 'relative',
        background: alpha(C.sf, 0.6),
        backdropFilter: 'blur(16px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
        borderRadius: 20,
        border: `1px solid ${alpha(C.bd, 0.35)}`,
        borderTop: `1px solid ${alpha('#ffffff', 0.08)}`,
        borderLeft: `1px solid ${alpha('#ffffff', 0.05)}`,
        boxShadow: `0 8px 32px ${alpha('#000000', 0.2)}, inset 0 1px 0 ${alpha('#ffffff', 0.05)}`,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* ─── Specular Highlight (top edge glow) ───────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.12)}, transparent)`,
          pointerEvents: 'none',
        }}
      />

      {/* ─── Header ───────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px 0', ...stagger(0) }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 24 }}>🌅</span>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: C.t1,
              fontFamily: F || 'var(--tf-font)',
              letterSpacing: '-0.01em',
            }}
          >
            {getGreeting()}
          </h2>
        </div>
        <p
          style={{
            margin: '2px 0 0 34px',
            fontSize: 12,
            fontWeight: 500,
            color: C.t3,
            fontFamily: F || 'var(--tf-font)',
          }}
        >
          {getFormattedDate()}
        </p>
      </div>

      {/* ─── Narrative ────────────────────────────────────────── */}
      <div style={{ padding: '16px 28px 0', ...stagger(1) }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: C.t2,
            fontFamily: F || 'var(--tf-font)',
            lineHeight: 1.7,
            maxWidth: 680,
          }}
        >
          {narrative}
        </p>
      </div>

      {/* ─── Stats Row ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 28px 0',
          flexWrap: 'wrap',
          ...stagger(2),
        }}
      >
        {/* Key Events */}
        <StatChip
          label={`${highImpactCount} High-Impact Event${highImpactCount !== 1 ? 's' : ''}`}
          icon="📅"
          color={C.t2}
        />

        {/* Watchlist Trend */}
        {watchlistTrendLabel && (
          <StatChip
            label={watchlistTrendLabel}
            icon="📊"
            color={watchlistTrendLabel === 'Mostly Green' ? C.g : watchlistTrendLabel === 'Mostly Red' ? C.r : C.t2}
          />
        )}

        {/* Regime Badge */}
        {regime && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              background: alpha(regimeColor, 0.1),
              border: `1px solid ${alpha(regimeColor, 0.2)}`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: regimeColor,
                boxShadow: `0 0 6px ${alpha(regimeColor, 0.5)}`,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: regimeColor,
                fontFamily: 'var(--tf-mono)',
                letterSpacing: '0.02em',
              }}
            >
              {regime}
            </span>
          </div>
        )}
      </div>

      {/* ─── Expand / Collapse Button ─────────────────────────── */}
      <div style={{ padding: '18px 28px 0', ...stagger(3) }}>
        <button
          onClick={handleToggleExpand}
          className="tf-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: alpha(C.b, 0.08),
            border: `1px solid ${alpha(C.b, 0.18)}`,
            borderRadius: 10,
            color: C.b,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: F || 'var(--tf-font)',
            transition: 'all 0.2s ease',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 14 }}>{expanded ? '▴' : '▾'}</span>
          {expanded ? 'Collapse Briefing' : 'Expand Full Briefing'}
        </button>
      </div>

      {/* ─── Expanded Sections ────────────────────────────────── */}
      {expanded && (
        <div
          style={{
            padding: '16px 28px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'tfBriefFadeUp 0.35s ease both',
          }}
        >
          <BriefingSection
            title="Your Watchlist"
            icon="🎯"
            count={(briefing.watchlistDigest || []).length}
            expanded={expandedSections.watchlist}
            onToggle={() => toggleSection('watchlist')}
          >
            <WatchlistDigest items={briefing.watchlistDigest} />
          </BriefingSection>

          <BriefingSection
            title="Overnight Movers"
            icon="📈"
            expanded={expandedSections.movers}
            onToggle={() => toggleSection('movers')}
          >
            <OvernightMovers movers={briefing.overnightMovers} />
          </BriefingSection>

          <BriefingSection
            title="Economic Calendar"
            icon="📅"
            count={(briefing.eventsToday || []).length}
            expanded={expandedSections.events}
            onToggle={() => toggleSection('events')}
          >
            <EventsToday events={briefing.eventsToday} />
          </BriefingSection>

          <BriefingSection
            title="Sentiment Snapshot"
            icon="🌡️"
            expanded={expandedSections.sentiment}
            onToggle={() => toggleSection('sentiment')}
          >
            <SentimentSnapshot data={briefing.sentiment} />
          </BriefingSection>

          {briefing.edgeInsights && briefing.edgeInsights.length > 0 && (
            <BriefingSection
              title="Your Edge Today"
              icon="⚡"
              expanded={expandedSections.edge}
              onToggle={() => toggleSection('edge')}
              accent
            >
              <EdgeInsights insights={briefing.edgeInsights} />
            </BriefingSection>
          )}
        </div>
      )}

      {/* ─── Ask Copilot CTA ──────────────────────────────────── */}
      <div style={{ padding: '18px 28px 24px', ...stagger(expanded ? 4 : 4) }}>
        <button
          className="tf-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 20px',
            background: `linear-gradient(135deg, ${C.b}, ${alpha(C.b, 0.8)})`,
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: F || 'var(--tf-font)',
            letterSpacing: '0.01em',
            transition: 'all 0.2s ease',
            boxShadow: `0 4px 16px ${alpha(C.b, 0.3)}`,
          }}
        >
          <span style={{ fontSize: 16 }}>🤖</span>
          Ask Copilot
        </button>
      </div>
    </div>
  );
}

// ─── StatChip Sub-component ───────────────────────────────────────

function StatChip({ label, icon, color }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 8,
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.4)}`,
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color,
          fontFamily: 'var(--tf-mono)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default React.memo(TheBrief);
