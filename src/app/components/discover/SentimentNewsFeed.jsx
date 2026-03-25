// ═══════════════════════════════════════════════════════════════════
// charEdge — Sentiment News Feed (NLP-Enhanced)
//
// Sprint 15: AI-driven sentiment classification for news.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import DemoBadge from './DemoBadge';
import st from './SentimentNewsFeed.module.css';
import { alpha } from '@/shared/colorUtils';

const MOCK_NEWS = [
  {
    id: 1,
    time: '2m ago',
    headline: 'NVIDIA beats Q4 earnings expectations, guides higher for AI demand',
    source: 'Reuters',
    sentiment: 'bullish',
    confidence: 92,
    impact: 'high',
    symbols: ['NVDA'],
    keywords: ['earnings', 'AI', 'guidance'],
  },
  {
    id: 2,
    time: '8m ago',
    headline: 'Fed officials signal patience on rate cuts, citing sticky inflation',
    source: 'Bloomberg',
    sentiment: 'bearish',
    confidence: 85,
    impact: 'high',
    symbols: ['SPY', 'QQQ'],
    keywords: ['Fed', 'rates', 'inflation'],
  },
  {
    id: 3,
    time: '15m ago',
    headline: 'Tesla announces new Model Q at sub-$25K price point',
    source: 'CNBC',
    sentiment: 'bullish',
    confidence: 78,
    impact: 'medium',
    symbols: ['TSLA'],
    keywords: ['Tesla', 'Model Q', 'EV'],
  },
  {
    id: 4,
    time: '22m ago',
    headline: 'Apple faces EU antitrust fine over App Store policies',
    source: 'FT',
    sentiment: 'bearish',
    confidence: 71,
    impact: 'medium',
    symbols: ['AAPL'],
    keywords: ['antitrust', 'EU', 'regulation'],
  },
  {
    id: 5,
    time: '34m ago',
    headline: 'Bitcoin ETF inflows hit record $1.2B as institutions pile in',
    source: 'CoinDesk',
    sentiment: 'bullish',
    confidence: 88,
    impact: 'high',
    symbols: ['BTC'],
    keywords: ['ETF', 'institutional', 'inflows'],
  },
  {
    id: 6,
    time: '41m ago',
    headline: 'Amazon expands same-day delivery to 30 new cities',
    source: 'WSJ',
    sentiment: 'bullish',
    confidence: 65,
    impact: 'low',
    symbols: ['AMZN'],
    keywords: ['delivery', 'expansion'],
  },
  {
    id: 7,
    time: '52m ago',
    headline: 'China tech crackdown concerns resurface after Alibaba probe',
    source: 'SCMP',
    sentiment: 'bearish',
    confidence: 74,
    impact: 'medium',
    symbols: ['BABA', 'JD'],
    keywords: ['China', 'regulation', 'tech'],
  },
  {
    id: 8,
    time: '1h ago',
    headline: 'Oil prices surge 3% on Middle East supply disruption fears',
    source: 'Reuters',
    sentiment: 'neutral',
    confidence: 60,
    impact: 'medium',
    symbols: ['XOM', 'CL'],
    keywords: ['oil', 'geopolitical', 'supply'],
  },
  {
    id: 9,
    time: '1h ago',
    headline: 'Microsoft Azure revenue growth accelerates to 31% YoY',
    source: 'TechCrunch',
    sentiment: 'bullish',
    confidence: 82,
    impact: 'medium',
    symbols: ['MSFT'],
    keywords: ['cloud', 'Azure', 'growth'],
  },
  {
    id: 10,
    time: '2h ago',
    headline: 'Semiconductor stocks rally on AI infrastructure spending forecasts',
    source: 'Bloomberg',
    sentiment: 'bullish',
    confidence: 76,
    impact: 'medium',
    symbols: ['NVDA', 'AMD', 'AVGO'],
    keywords: ['semis', 'AI', 'capex'],
  },
];

const SENTIMENT_META = {
  bullish: { icon: '🟢', color: C.g, label: 'Bullish' },
  bearish: { icon: '🔴', color: C.r, label: 'Bearish' },
  neutral: { icon: '🟡', color: '#f0b64e', label: 'Neutral' },
};

const IMPACT_META = {
  high: { label: 'HIGH', color: C.r },
  medium: { label: 'MED', color: '#f0b64e' },
  low: { label: 'LOW', color: '#7078a0' },
};

function SentimentNewsFeed({ compact }) {
  const [filter, setFilter] = useState('all');

  const news = useMemo(() => {
    if (filter === 'bullish') return MOCK_NEWS.filter((n) => n.sentiment === 'bullish');
    if (filter === 'bearish') return MOCK_NEWS.filter((n) => n.sentiment === 'bearish');
    if (filter === 'breaking') return MOCK_NEWS.filter((n) => n.impact === 'high');
    return MOCK_NEWS;
  }, [filter]);

  const aggSentiment = useMemo(() => {
    let bull = 0,
      bear = 0,
      neut = 0;
    for (const n of MOCK_NEWS) {
      if (n.sentiment === 'bullish') bull++;
      else if (n.sentiment === 'bearish') bear++;
      else neut++;
    }
    return { bull, bear, neut, total: MOCK_NEWS.length };
  }, []);

  if (compact) {
    return (
      <div className={st.compactCard} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
        <div className={st.headerCompact}>
          <span className={st.headerIconSm}>📰</span>
          <span className={st.headerTitleSm}>Sentiment News</span>
          <div className={st.sentCountsSm}>
            <span className={st.sentCountSm} style={{ color: SENTIMENT_META.bullish.color }}>
              {aggSentiment.bull}🟢
            </span>
            <span className={st.sentCountSm} style={{ color: SENTIMENT_META.bearish.color }}>
              {aggSentiment.bear}🔴
            </span>
          </div>
        </div>
        <div className={st.newsListSm}>
          {MOCK_NEWS.slice(0, 5).map((n) => {
            const sm = SENTIMENT_META[n.sentiment];
            const im = IMPACT_META[n.impact];
            return (
              <div key={n.id} className={st.compactRow} style={{ borderBottom: `1px solid ${alpha(C.bd, 0.5)}` }}>
                <div className={st.newsMetaSm}>
                  <span className={st.sentIconSm} style={{ color: sm.color }}>
                    {sm.icon}
                  </span>
                  <span className={st.impactBadge} style={{ color: im.color }}>
                    {im.label}
                  </span>
                  <span className={st.timeTextSm} style={{ color: C.t3 }}>
                    {n.time}
                  </span>
                </div>
                <div className={st.headlineSm}>{n.headline}</div>
                <div className={st.tagsSm}>
                  {n.symbols.map((s) => (
                    <span key={s} className={st.symTagSm} style={{ color: C.b }}>
                      ${s}
                    </span>
                  ))}
                  <span className={st.sourceTextSm} style={{ color: C.t3 }}>
                    {n.source}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <div className={st.headerFull}>
        <div className={st.headerRow}>
          <span className={st.headerIcon}>📰</span>
          <h3 className={st.headerTitle}>Sentiment News Feed</h3>
          <DemoBadge />
          <div className={st.sentCounts}>
            <span className={st.sentCount} style={{ color: SENTIMENT_META.bullish.color }}>
              {aggSentiment.bull} 🟢
            </span>
            <span className={st.sentCount} style={{ color: SENTIMENT_META.bearish.color }}>
              {aggSentiment.bear} 🔴
            </span>
            <span className={st.sentCount} style={{ color: SENTIMENT_META.neutral.color }}>
              {aggSentiment.neut} 🟡
            </span>
          </div>
        </div>

        <div className={st.filterRow}>
          {['all', 'bullish', 'bearish', 'breaking'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`tf-btn ${st.filterBtn}`}
              style={{
                border: `1px solid ${filter === f ? C.b : 'transparent'}`,
                background: filter === f ? alpha(C.b, 0.08) : 'transparent',
                color: filter === f ? C.b : C.t3,
              }}
            >
              {f === 'all' ? '📋 All' : f === 'bullish' ? '🟢 Bull' : f === 'bearish' ? '🔴 Bear' : '🔥 Breaking'}
            </button>
          ))}
        </div>

        <div className={st.newsList}>
          {news.map((n) => {
            const sm = SENTIMENT_META[n.sentiment];
            const im = IMPACT_META[n.impact];
            return (
              <div
                key={n.id}
                className={st.newsRow}
                style={{
                  background: alpha(C.sf, 0.5),
                  border: `1px solid ${n.impact === 'high' ? alpha(C.r, 0.15) : alpha(C.bd, 0.3)}`,
                }}
              >
                <div className={st.newsMeta}>
                  <span className={st.sentIcon}>{sm.icon}</span>
                  <span className={st.sentLabel} style={{ color: sm.color }}>
                    {sm.label} {n.confidence}%
                  </span>
                  <span className={st.impactBadge} style={{ color: im.color, background: alpha(im.color, 0.1) }}>
                    {im.label}
                  </span>
                  <span className={st.timeText} style={{ color: C.t3 }}>
                    {n.time}
                  </span>
                </div>
                <div className={st.headline}>{n.headline}</div>
                <div className={st.tagsRow}>
                  {n.symbols.map((s) => (
                    <span key={s} className={st.symTag} style={{ color: C.b, background: alpha(C.b, 0.08) }}>
                      ${s}
                    </span>
                  ))}
                  {n.keywords.map((k) => (
                    <span key={k} className={st.kwTag} style={{ color: C.t3, background: alpha(C.t3, 0.08) }}>
                      #{k}
                    </span>
                  ))}
                  <span className={st.sourceText} style={{ color: C.t3 }}>
                    {n.source}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { SentimentNewsFeed };
export default React.memo(SentimentNewsFeed);
