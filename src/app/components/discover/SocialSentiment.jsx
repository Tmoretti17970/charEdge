// ═══════════════════════════════════════════════════════════════════
// charEdge — Social Sentiment
//
// Trending ticker sentiment from StockTwits/X/Reddit.
// Shows bull/bear bars, mention counts, and trend direction.
// ═══════════════════════════════════════════════════════════════════

import { MessageCircle, TrendingUp, TrendingDown } from 'lucide-react';
import React, { useState } from 'react';
import IntelCard from './IntelCard.jsx';
import s from './SocialSentiment.module.css';

// Mock trending data (will be replaced with StockTwits/Finnhub API)
const TRENDING = [
  { symbol: 'NVDA', mentions: 12400, sentiment: 78, change: 12, trend: 'up' },
  { symbol: 'TSLA', mentions: 9800, sentiment: 52, change: -5, trend: 'down' },
  { symbol: 'AAPL', mentions: 7200, sentiment: 65, change: 3, trend: 'up' },
  { symbol: 'BTC', mentions: 18500, sentiment: 72, change: 8, trend: 'up' },
  { symbol: 'META', mentions: 5600, sentiment: 81, change: 15, trend: 'up' },
  { symbol: 'SPY', mentions: 8900, sentiment: 58, change: -2, trend: 'down' },
  { symbol: 'AMD', mentions: 4200, sentiment: 69, change: 6, trend: 'up' },
  { symbol: 'ETH', mentions: 6800, sentiment: 61, change: 4, trend: 'up' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'bullish', label: 'Bullish' },
  { id: 'bearish', label: 'Bearish' },
];

function getSentimentColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
}

function getSentimentLabel(score) {
  if (score >= 70) return 'Bullish';
  if (score >= 55) return 'Mixed';
  return 'Bearish';
}

function formatMentions(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function SocialSentiment() {
  const [filter, setFilter] = useState('all');

  const filtered = TRENDING.filter((t) => {
    if (filter === 'bullish') return t.sentiment >= 60;
    if (filter === 'bearish') return t.sentiment < 50;
    return true;
  });

  return (
    <IntelCard
      icon={<MessageCircle size={18} />}
      title="Social Sentiment"
      badge={`${TRENDING.length} trending`}
      collapsible
    >
      {/* Filter pills */}
      <div className={s.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={s.filterBtn}
            style={{
              background: filter === f.id ? 'rgba(92, 156, 245, 0.1)' : 'transparent',
              color: filter === f.id ? '#5c9cf5' : 'var(--tf-t3)',
              border: `1px solid ${filter === f.id ? 'rgba(92, 156, 245, 0.2)' : 'transparent'}`,
            }}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className={s.sourceLabel}>StockTwits + X</span>
      </div>

      {/* Sentiment rows */}
      <div className={s.list}>
        {filtered.map((ticker) => {
          const bullPct = ticker.sentiment;
          const bearPct = 100 - ticker.sentiment;
          const color = getSentimentColor(ticker.sentiment);

          return (
            <div key={ticker.symbol} className={s.row}>
              {/* Symbol */}
              <div className={s.symbol}>{ticker.symbol}</div>

              {/* Sentiment bar */}
              <div className={s.barWrap}>
                <div className={s.barBull} style={{ width: `${bullPct}%` }} />
                <div className={s.barBear} style={{ width: `${bearPct}%` }} />
              </div>

              {/* Score */}
              <span className={s.score} style={{ color }}>
                {ticker.sentiment}%
              </span>

              {/* Label */}
              <span className={s.label} style={{ color }}>
                {getSentimentLabel(ticker.sentiment)}
              </span>

              {/* Mentions */}
              <span className={s.mentions}>{formatMentions(ticker.mentions)}</span>

              {/* Trend */}
              <span className={s.trend} style={{ color: ticker.trend === 'up' ? '#22c55e' : '#ef4444' }}>
                {ticker.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {ticker.change > 0 ? '+' : ''}
                {ticker.change}%
              </span>
            </div>
          );
        })}
      </div>
    </IntelCard>
  );
}

export default React.memo(SocialSentiment);
