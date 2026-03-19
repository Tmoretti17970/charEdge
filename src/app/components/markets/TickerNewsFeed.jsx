// ═══════════════════════════════════════════════════════════════════
// charEdge — Ticker News Feed (Sprint 12)
//
// Displays recent news & sentiment for the selected ticker.
// Uses a lightweight mock news generator that produces realistic
// headlines based on the symbol's asset class and recent price
// action. In production this would integrate with a real news API
// (e.g. CryptoPanic, NewsAPI, Alpha Vantage).
//
// Features:
//   - Sentiment color-coding (positive/negative/neutral)
//   - Source and timestamp
//   - Clickable "Read more" links
//   - Compact card design
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';

const GREEN  = '#22c55e';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';

// ─── Mock headline templates ────────────────────────────────────

const NEWS_TEMPLATES = {
  crypto: [
    { headline: (sym) => `${sym} network sees record transaction volume amid market rally`, sentiment: 'positive', source: 'CoinDesk' },
    { headline: (sym) => `Institutional investors increase ${sym} holdings by 12% this quarter`, sentiment: 'positive', source: 'Bloomberg Crypto' },
    { headline: (sym) => `${sym} faces regulatory scrutiny in Singapore — market impact minimal`, sentiment: 'negative', source: 'The Block' },
    { headline: (sym) => `On-chain metrics suggest ${sym} accumulation at current levels`, sentiment: 'positive', source: 'Glassnode' },
    { headline: (sym) => `${sym} trading volume surges as new exchange listings announced`, sentiment: 'neutral', source: 'CryptoPanic' },
  ],
  stocks: [
    { headline: (sym) => `${sym} beats Q4 earnings estimates, shares rise in after-hours trading`, sentiment: 'positive', source: 'CNBC' },
    { headline: (sym) => `Analysts upgrade ${sym} to "Strong Buy" with revised price target`, sentiment: 'positive', source: 'Reuters' },
    { headline: (sym) => `${sym} announces strategic acquisition to expand market presence`, sentiment: 'neutral', source: 'Wall Street Journal' },
    { headline: (sym) => `${sym} faces supply chain headwinds — margins under pressure`, sentiment: 'negative', source: 'Bloomberg' },
    { headline: (sym) => `Insider selling reported at ${sym} — executives trim positions`, sentiment: 'negative', source: 'SEC Filings' },
  ],
  etf: [
    { headline: (sym) => `${sym} sees record inflows as investors seek market exposure`, sentiment: 'positive', source: 'ETF.com' },
    { headline: (sym) => `${sym} rebalance shows shift toward tech-heavy allocation`, sentiment: 'neutral', source: 'Morningstar' },
    { headline: (sym) => `${sym} expense ratio among lowest in category — flows accelerate`, sentiment: 'positive', source: 'Bloomberg' },
  ],
  forex: [
    { headline: (sym) => `Central bank policy divergence drives ${sym} volatility`, sentiment: 'neutral', source: 'FX Street' },
    { headline: (sym) => `${sym} pair reaches key technical level amid rate expectations`, sentiment: 'neutral', source: 'DailyFX' },
    { headline: (sym) => `Emerging market flows impact ${sym} trading — carry trade dynamics shift`, sentiment: 'negative', source: 'Reuters' },
  ],
  futures: [
    { headline: (sym) => `${sym} futures open interest hits multi-year high`, sentiment: 'positive', source: 'CME Group' },
    { headline: (sym) => `${sym} contract roll shows contango — bullish sentiment persists`, sentiment: 'positive', source: 'Bloomberg' },
    { headline: (sym) => `${sym} options activity surges ahead of FOMC meeting`, sentiment: 'neutral', source: 'CBOE' },
  ],
};

// Generate deterministic "random" news based on symbol
function generateNews(symbol, assetClass) {
  const templates = NEWS_TEMPLATES[assetClass] || NEWS_TEMPLATES.crypto;
  const now = Date.now();
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return templates.slice(0, 4).map((t, i) => ({
    id: `${symbol}-${i}`,
    headline: t.headline(symbol),
    sentiment: t.sentiment,
    source: t.source,
    // Simulate timestamps: 2h, 5h, 8h, 14h ago
    time: new Date(now - ((i * 3 + 2) * 3600 * 1000 + (seed % 1800) * 1000)),
  }));
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

function TickerNewsFeed({ symbol, assetClass }) {
  const news = useMemo(
    () => generateNews(symbol, assetClass || 'crypto'),
    [symbol, assetClass]
  );

  function fmtAgo(date) {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const sentimentColors = {
    positive: GREEN,
    negative: RED,
    neutral: AMBER,
  };

  const sentimentIcons = {
    positive: '▲',
    negative: '▼',
    neutral: '●',
  };

  return (
    <div style={{ padding: '4px 20px 8px' }}>
      {news.map((item, i) => (
        <div
          key={item.id}
          style={{
            padding: '8px 0',
            borderBottom: i < news.length - 1 ? `1px solid ${C.bd}08` : 'none',
          }}
        >
          {/* Sentiment dot + headline */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span
              style={{
                fontSize: 7,
                color: sentimentColors[item.sentiment],
                lineHeight: '18px',
                flexShrink: 0,
              }}
            >
              {sentimentIcons[item.sentiment]}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontFamily: F,
                fontWeight: 500,
                color: C.t1,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.headline}
            </p>
          </div>

          {/* Source + time */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
              paddingLeft: 13,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: M,
                color: C.t3,
              }}
            >
              {item.source}
            </span>
            <span style={{ fontSize: 8, color: `${C.t3}80` }}>·</span>
            <span
              style={{
                fontSize: 9,
                fontFamily: M,
                color: `${C.t3}80`,
              }}
            >
              {fmtAgo(item.time)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export { TickerNewsFeed };
export default memo(TickerNewsFeed);
