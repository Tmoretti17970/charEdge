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
// Integrates with: useWatchlistStore, useJournalStore, useBriefingStore
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useBriefingStore } from '../../../state/useBriefingStore.js';
import { fetchBriefingData } from '../../../services/briefingService.js';

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

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
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: C.t1,
                fontFamily: F,
              }}
            >
              {briefing.greeting}, Trader
            </h2>
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
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: C.t2,
              fontFamily: F,
              lineHeight: 1.6,
              maxWidth: 600,
            }}
          >
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
        {/* Section 1: Watchlist Digest */}
        <BriefingSection
          id="watchlist"
          title="Your Watchlist"
          icon="🎯"
          count={briefing.watchlistDigest.length}
          expanded={expandedSections.watchlist}
          onToggle={() => toggleSection('watchlist')}
        >
          <WatchlistDigest items={briefing.watchlistDigest} />
        </BriefingSection>

        {/* Section 2: Overnight Movers */}
        <BriefingSection
          id="movers"
          title="Overnight Movers"
          icon="📈"
          expanded={expandedSections.movers}
          onToggle={() => toggleSection('movers')}
        >
          <OvernightMovers movers={briefing.overnightMovers} />
        </BriefingSection>

        {/* Section 3: Economic Events Today */}
        <BriefingSection
          id="events"
          title="Economic Calendar"
          icon="📅"
          count={briefing.eventsToday.length}
          expanded={expandedSections.events}
          onToggle={() => toggleSection('events')}
        >
          <EventsToday events={briefing.eventsToday} />
        </BriefingSection>

        {/* Section 4: Sentiment Snapshot */}
        <BriefingSection
          id="sentiment"
          title="Sentiment Snapshot"
          icon="🌡️"
          expanded={expandedSections.sentiment}
          onToggle={() => toggleSection('sentiment')}
        >
          <SentimentSnapshot data={briefing.sentiment} />
        </BriefingSection>

        {/* Section 5: Your Edge Today */}
        {briefing.edgeInsights.length > 0 && (
          <BriefingSection
            id="edge"
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Collapsible Section Wrapper
// ═══════════════════════════════════════════════════════════════════

function BriefingSection({ title, icon, count, expanded, onToggle, accent, children }) {
  return (
    <div
      style={{
        background: accent ? alpha(C.b, 0.04) : alpha(C.sf, 0.5),
        borderRadius: 12,
        border: `1px solid ${accent ? alpha(C.b, 0.12) : alpha(C.bd, 0.5)}`,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      <button
        onClick={onToggle}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.t1,
              fontFamily: F,
            }}
          >
            {title}
          </span>
          {count !== undefined && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.t3,
                background: alpha(C.t3, 0.1),
                padding: '2px 6px',
                borderRadius: 4,
                fontFamily: M,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            color: C.t3,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: '0 16px 14px',
            animation: 'tfSubTabsIn 0.2s ease forwards',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 1: Watchlist Digest
// ═══════════════════════════════════════════════════════════════════

function WatchlistDigest({ items }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>
        Add symbols to your watchlist to see personalized insights here
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <WatchlistCard key={item.symbol} item={item} />
      ))}
    </div>
  );
}

function WatchlistCard({ item }) {
  const isUp = item.change >= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 12px',
        background: alpha(C.bg2, 0.6),
        borderRadius: 10,
        border: `1px solid ${alpha(C.bd, 0.3)}`,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Symbol + Price */}
      <div style={{ minWidth: 90 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {item.symbol}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: isUp ? C.g : C.r,
              fontFamily: M,
            }}
          >
            {isUp ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: M }}>
          {formatPrice(item.price)}
        </div>
      </div>

      {/* Pattern / Signal */}
      {item.pattern && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <SignalDot signal={item.pattern.signal} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F }}>
              {item.pattern.pattern}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.t3,
              fontFamily: F,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.pattern.description}
          </div>
        </div>
      )}

      {/* Key Levels */}
      {item.keyLevels && !item.pattern && (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: M, color: C.t3 }}>
            <span>
              S: <span style={{ color: C.r }}>{formatPrice(item.keyLevels.support[0])}</span>
            </span>
            <span>
              R: <span style={{ color: C.g }}>{formatPrice(item.keyLevels.resistance[0])}</span>
            </span>
          </div>
        </div>
      )}

      {/* News headline (if any) */}
      {item.news.length > 0 && (
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              fontFamily: F,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <NewsSentimentDot sentiment={item.news[0].sentiment} />
            {' '}{item.news[0].headline}
          </div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 2 }}>
            {item.news[0].source}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 2: Overnight Movers
// ═══════════════════════════════════════════════════════════════════

function OvernightMovers({ movers }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {movers.map((m) => {
        const isUp = m.direction === 'up';
        return (
          <div
            key={m.symbol}
            style={{
              flex: '1 1 auto',
              minWidth: 100,
              padding: '10px 12px',
              background: alpha(isUp ? C.g : C.r, 0.06),
              border: `1px solid ${alpha(isUp ? C.g : C.r, 0.15)}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>
                {m.symbol}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: isUp ? C.g : C.r, fontFamily: M }}>
                {isUp ? '+' : ''}{m.change.toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              {formatPrice(m.price)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 3: Events Today
// ═══════════════════════════════════════════════════════════════════

function EventsToday({ events }) {
  const impactColors = { high: C.r, medium: C.y, low: C.g };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {events.map((evt, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            background: alpha(C.bg2, 0.5),
            borderRadius: 8,
            borderLeft: `3px solid ${impactColors[evt.impact] || C.t3}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.t2,
              fontFamily: M,
              minWidth: 44,
            }}
          >
            {evt.time}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>
                {evt.event}
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: impactColors[evt.impact],
                  background: alpha(impactColors[evt.impact] || C.t3, 0.12),
                  padding: '2px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontFamily: F,
                }}
              >
                {evt.impact}
              </span>
              <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                {evt.country}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: M, color: C.t3, flexShrink: 0 }}>
            {evt.previous !== '—' && (
              <span>
                Prev: <span style={{ color: C.t2 }}>{evt.previous}</span>
              </span>
            )}
            {evt.forecast !== '—' && (
              <span>
                Est: <span style={{ color: C.t2 }}>{evt.forecast}</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 4: Sentiment Snapshot
// ═══════════════════════════════════════════════════════════════════

function SentimentSnapshot({ data }) {
  const fgColor = data.fearGreed > 70 ? C.g : data.fearGreed > 40 ? C.y : C.r;
  const socialColor = data.socialSentiment > 60 ? C.g : data.socialSentiment > 40 ? C.y : C.r;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      <SentimentCard
        label="Fear & Greed"
        value={data.fearGreed}
        sub={data.fearGreedLabel}
        color={fgColor}
      />
      <SentimentCard
        label="Social Sentiment"
        value={data.socialSentiment}
        sub={data.socialLabel}
        color={socialColor}
      />
      <SentimentCard
        label="BTC Dominance"
        value={`${data.btcDominance}%`}
        sub=""
        color={C.t1}
      />
      <SentimentCard
        label="Total Market Cap"
        value={`$${data.totalMarketCap}`}
        sub=""
        color={C.t1}
      />
    </div>
  );
}

function SentimentCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: alpha(C.bg2, 0.6),
        borderRadius: 10,
        border: `1px solid ${alpha(C.bd, 0.3)}`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: F, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: M, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginTop: 2, fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 5: Edge Insights
// ═══════════════════════════════════════════════════════════════════

function EdgeInsights({ insights }) {
  const typeColors = { positive: C.g, caution: C.y, info: C.b };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {insights.map((insight, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            background: alpha(typeColors[insight.type] || C.b, 0.06),
            border: `1px solid ${alpha(typeColors[insight.type] || C.b, 0.12)}`,
            borderRadius: 10,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{insight.icon}</span>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: C.t2,
              fontFamily: F,
              lineHeight: 1.6,
            }}
          >
            {insight.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════

function SignalDot({ signal }) {
  const colors = { bullish: C.g, bearish: C.r, neutral: C.y };
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[signal] || C.t3,
        boxShadow: `0 0 4px ${alpha(colors[signal] || C.t3, 0.4)}`,
        flexShrink: 0,
      }}
    />
  );
}

function NewsSentimentDot({ sentiment }) {
  const colors = { bullish: C.g, bearish: C.r, neutral: C.y };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: colors[sentiment] || C.t3,
        marginRight: 4,
        verticalAlign: 'middle',
      }}
    />
  );
}

function formatPrice(price) {
  if (price == null) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

// ═══════════════════════════════════════════════════════════════════
// Skeleton Loader
// ═══════════════════════════════════════════════════════════════════

function BriefingSkeleton() {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${alpha(C.b, 0.04)}, ${alpha(C.p, 0.03)})`,
        border: `1px solid ${alpha(C.b, 0.12)}`,
        borderRadius: 18,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          className="tf-skeleton-pulse"
          style={{ width: 24, height: 24, borderRadius: 6, background: alpha(C.t3, 0.1) }}
        />
        <div
          className="tf-skeleton-pulse"
          style={{ width: 200, height: 20, borderRadius: 6, background: alpha(C.t3, 0.1) }}
        />
      </div>
      <div
        className="tf-skeleton-pulse"
        style={{ width: '80%', height: 14, borderRadius: 4, background: alpha(C.t3, 0.08), marginBottom: 20 }}
      />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="tf-skeleton-pulse"
          style={{
            width: '100%',
            height: 48,
            borderRadius: 10,
            background: alpha(C.t3, 0.06),
            marginBottom: 8,
          }}
        />
      ))}
    </div>
  );
}

export { MorningBriefing };
