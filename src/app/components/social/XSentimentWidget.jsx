import { useEffect, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { fetchXSentiment } from '../../../services/socialService.js';
import { alpha } from '../../../utils/colorUtils.js';

export default function XSentimentWidget({ category = 'all' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchXSentiment(category).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [category]);

  if (loading || !data) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3 }}>
        Loading sentiment...
      </div>
    );
  }

  const isBullish = data.label.toLowerCase() === 'bullish';
  const color = isBullish ? C.up : data.label.toLowerCase() === 'bearish' ? C.dn : C.t2;

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>X (Twitter) Sentiment</h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={C.t2}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `4px solid ${alpha(color, 0.2)}`,
            borderTopColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 800, fontFamily: M, color: C.t1 }}>{data.score}</span>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>{data.label}</div>
          <div style={{ fontSize: 13, color: C.t2 }}>
            Based on {data.mentionVolume24h.toLocaleString()} mentions (24h)
          </div>
          <div style={{ fontSize: 12, color: data.volumeChangePct > 0 ? C.up : C.dn, marginTop: 4, fontWeight: 600 }}>
            {data.volumeChangePct > 0 ? '+' : ''}
            {data.volumeChangePct}% vs yesterday
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {data.topKeywords.map((kw) => (
          <span
            key={kw}
            style={{
              background: alpha(C.b, 0.1),
              color: C.b,
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: F,
            }}
          >
            {kw}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 8, height: 6, display: 'flex', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${data.breakdown.bullish}%`, background: C.up }} />
        <div style={{ width: `${data.breakdown.neutral}%`, background: C.t3 }} />
        <div style={{ width: `${data.breakdown.bearish}%`, background: C.dn }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.t3, fontFamily: M }}>
        <span>{data.breakdown.bullish}% Bullish</span>
        <span>{data.breakdown.neutral}% Neutral</span>
        <span>{data.breakdown.bearish}% Bearish</span>
      </div>
    </div>
  );
}
