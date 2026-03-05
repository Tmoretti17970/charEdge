// ═══════════════════════════════════════════════════════════════════
// charEdge — Sentiment News Feed (NLP-Enhanced)
//
// Sprint 15: AI-driven sentiment classification for news.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

const MOCK_NEWS = [
  { id: 1, time: '2m ago', headline: 'NVIDIA beats Q4 earnings expectations, guides higher for AI demand', source: 'Reuters', sentiment: 'bullish', confidence: 92, impact: 'high', symbols: ['NVDA'], keywords: ['earnings', 'AI', 'guidance'] },
  { id: 2, time: '8m ago', headline: 'Fed officials signal patience on rate cuts, citing sticky inflation', source: 'Bloomberg', sentiment: 'bearish', confidence: 85, impact: 'high', symbols: ['SPY', 'QQQ'], keywords: ['Fed', 'rates', 'inflation'] },
  { id: 3, time: '15m ago', headline: 'Tesla announces new Model Q at sub-$25K price point', source: 'CNBC', sentiment: 'bullish', confidence: 78, impact: 'medium', symbols: ['TSLA'], keywords: ['Tesla', 'Model Q', 'EV'] },
  { id: 4, time: '22m ago', headline: 'Apple faces EU antitrust fine over App Store policies', source: 'FT', sentiment: 'bearish', confidence: 71, impact: 'medium', symbols: ['AAPL'], keywords: ['antitrust', 'EU', 'regulation'] },
  { id: 5, time: '34m ago', headline: 'Bitcoin ETF inflows hit record $1.2B as institutions pile in', source: 'CoinDesk', sentiment: 'bullish', confidence: 88, impact: 'high', symbols: ['BTC'], keywords: ['ETF', 'institutional', 'inflows'] },
  { id: 6, time: '41m ago', headline: 'Amazon expands same-day delivery to 30 new cities', source: 'WSJ', sentiment: 'bullish', confidence: 65, impact: 'low', symbols: ['AMZN'], keywords: ['delivery', 'expansion'] },
  { id: 7, time: '52m ago', headline: 'China tech crackdown concerns resurface after Alibaba probe', source: 'SCMP', sentiment: 'bearish', confidence: 74, impact: 'medium', symbols: ['BABA', 'JD'], keywords: ['China', 'regulation', 'tech'] },
  { id: 8, time: '1h ago', headline: 'Oil prices surge 3% on Middle East supply disruption fears', source: 'Reuters', sentiment: 'neutral', confidence: 60, impact: 'medium', symbols: ['XOM', 'CL'], keywords: ['oil', 'geopolitical', 'supply'] },
  { id: 9, time: '1h ago', headline: 'Microsoft Azure revenue growth accelerates to 31% YoY', source: 'TechCrunch', sentiment: 'bullish', confidence: 82, impact: 'medium', symbols: ['MSFT'], keywords: ['cloud', 'Azure', 'growth'] },
  { id: 10, time: '2h ago', headline: 'Semiconductor stocks rally on AI infrastructure spending forecasts', source: 'Bloomberg', sentiment: 'bullish', confidence: 76, impact: 'medium', symbols: ['NVDA', 'AMD', 'AVGO'], keywords: ['semis', 'AI', 'capex'] },
];

const SENTIMENT_META = {
  bullish: { icon: '🟢', color: '#2dd4a0', label: 'Bullish' },
  bearish: { icon: '🔴', color: '#f25c5c', label: 'Bearish' },
  neutral: { icon: '🟡', color: '#f0b64e', label: 'Neutral' },
};

const IMPACT_META = {
  high: { label: 'HIGH', color: '#f25c5c' },
  medium: { label: 'MED', color: '#f0b64e' },
  low: { label: 'LOW', color: '#4e5266' },
};

export default function SentimentNewsFeed({ compact }) {
  const [filter, setFilter] = useState('all');

  const news = useMemo(() => {
    if (filter === 'bullish') return MOCK_NEWS.filter((n) => n.sentiment === 'bullish');
    if (filter === 'bearish') return MOCK_NEWS.filter((n) => n.sentiment === 'bearish');
    if (filter === 'breaking') return MOCK_NEWS.filter((n) => n.impact === 'high');
    return MOCK_NEWS;
  }, [filter]);

  // Aggregate sentiment
  const aggSentiment = useMemo(() => {
    let bull = 0, bear = 0, neut = 0;
    for (const n of MOCK_NEWS) {
      if (n.sentiment === 'bullish') bull++;
      else if (n.sentiment === 'bearish') bear++;
      else neut++;
    }
    return { bull, bear, neut, total: MOCK_NEWS.length };
  }, []);

  if (compact) {
    // Compact sidebar mode
    return (
      <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>📰</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>Sentiment News</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <span style={{ fontSize: 9, color: SENTIMENT_META.bullish.color, fontFamily: M, fontWeight: 600 }}>{aggSentiment.bull}🟢</span>
            <span style={{ fontSize: 9, color: SENTIMENT_META.bearish.color, fontFamily: M, fontWeight: 600 }}>{aggSentiment.bear}🔴</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOCK_NEWS.slice(0, 5).map((n) => {
            const sm = SENTIMENT_META[n.sentiment];
            const im = IMPACT_META[n.impact];
            return (
              <div key={n.id} style={{ paddingBottom: 6, borderBottom: `1px solid ${alpha(C.bd, 0.5)}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ fontSize: 8, color: sm.color }}>{sm.icon}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: im.color, fontFamily: M }}>{im.label}</span>
                  <span style={{ fontSize: 8, color: C.t3, marginLeft: 'auto', fontFamily: F }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 10, color: C.t1, fontFamily: F, lineHeight: 1.4, fontWeight: 500 }}>{n.headline}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  {n.symbols.map((s) => (
                    <span key={s} style={{ fontSize: 8, fontWeight: 700, color: C.b, fontFamily: M }}>${s}</span>
                  ))}
                  <span style={{ fontSize: 8, color: C.t3, fontFamily: F, marginLeft: 'auto' }}>{n.source}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>📰</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Sentiment News Feed</h3>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: 10, color: SENTIMENT_META.bullish.color, fontFamily: M, fontWeight: 600 }}>{aggSentiment.bull} 🟢</span>
            <span style={{ fontSize: 10, color: SENTIMENT_META.bearish.color, fontFamily: M, fontWeight: 600 }}>{aggSentiment.bear} 🔴</span>
            <span style={{ fontSize: 10, color: SENTIMENT_META.neutral.color, fontFamily: M, fontWeight: 600 }}>{aggSentiment.neut} 🟡</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {['all', 'bullish', 'bearish', 'breaking'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="tf-btn"
              style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${filter === f ? C.b : 'transparent'}`, background: filter === f ? alpha(C.b, 0.08) : 'transparent', color: filter === f ? C.b : C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F, textTransform: 'capitalize' }}>
              {f === 'all' ? '📋 All' : f === 'bullish' ? '🟢 Bull' : f === 'bearish' ? '🔴 Bear' : '🔥 Breaking'}
            </button>
          ))}
        </div>

        {/* News List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {news.map((n) => {
            const sm = SENTIMENT_META[n.sentiment];
            const im = IMPACT_META[n.impact];
            return (
              <div key={n.id} style={{ padding: '10px 12px', background: alpha(C.sf, 0.5), border: `1px solid ${n.impact === 'high' ? alpha(C.r, 0.15) : alpha(C.bd, 0.3)}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10 }}>{sm.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sm.color, fontFamily: F }}>{sm.label} {n.confidence}%</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: im.color, background: alpha(im.color, 0.1), padding: '1px 5px', borderRadius: 3, fontFamily: M }}>{im.label}</span>
                  <span style={{ fontSize: 9, color: C.t3, fontFamily: F, marginLeft: 'auto' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 12, color: C.t1, fontFamily: F, lineHeight: 1.5, fontWeight: 500, marginBottom: 6 }}>{n.headline}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {n.symbols.map((s) => (
                    <span key={s} style={{ fontSize: 9, fontWeight: 700, color: C.b, background: alpha(C.b, 0.08), padding: '1px 5px', borderRadius: 3, fontFamily: M }}>${s}</span>
                  ))}
                  {n.keywords.map((k) => (
                    <span key={k} style={{ fontSize: 8, color: C.t3, background: alpha(C.t3, 0.08), padding: '1px 5px', borderRadius: 3, fontFamily: F }}>#{k}</span>
                  ))}
                  <span style={{ fontSize: 9, color: C.t3, fontFamily: F, marginLeft: 'auto' }}>{n.source}</span>
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
