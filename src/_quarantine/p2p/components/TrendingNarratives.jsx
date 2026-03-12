import React from 'react';
import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';

// Helper to generate a realistic looking 24h volume sparkline (12 data points = 2h intervals)
function generateMockSparkline(trend) {
  const base = 20;
  const isUp = trend === 'up';
  return Array.from({ length: 12 }, (_, i) => {
    // Upward or downward curve with some noise
    const progress = i / 11;
    const curve = isUp ? progress * progress : 1 - progress * progress;
    const noise = (Math.random() - 0.5) * 15;
    return Math.max(0, base + curve * 40 + noise);
  });
}

const MOCK_NARRATIVES = {
  all: [
    {
      id: 'ai',
      name: 'AI Agents',
      metric: '+145% vol',
      trend: 'up',
      active: true,
      tokens: ['FET', 'AGIX', 'TAO'],
      sparkline: generateMockSparkline('up'),
    },
    {
      id: 'rates',
      name: 'Rate Cuts',
      metric: '+110% vol',
      trend: 'up',
      active: true,
      tokens: ['GOLD', 'SPY'],
      sparkline: generateMockSparkline('up'),
    },
    {
      id: 'l2',
      name: 'Ethereum L2s',
      metric: '+82% vol',
      trend: 'up',
      active: false,
      tokens: ['ARB', 'OP', 'STRK'],
      sparkline: generateMockSparkline('up'),
    },
  ],
  crypto: [
    {
      id: 'ai',
      name: 'AI Agents',
      metric: '+145% vol',
      trend: 'up',
      active: true,
      tokens: ['FET', 'AGIX', 'TAO'],
      sparkline: generateMockSparkline('up'),
    },
    {
      id: 'l2',
      name: 'Ethereum L2s',
      metric: '+82% vol',
      trend: 'up',
      active: true,
      tokens: ['ARB', 'OP', 'STRK'],
      sparkline: generateMockSparkline('up'),
    },
    {
      id: 'sol',
      name: 'Solana DeFi',
      metric: '+20% vol',
      trend: 'up',
      active: false,
      tokens: ['JUP', 'RAY'],
      sparkline: generateMockSparkline('up'),
    },
  ],
  macro: [
    {
      id: 'rates',
      name: 'Rate Cuts',
      metric: '+110% vol',
      trend: 'up',
      active: true,
      tokens: ['GOLD', 'TLT'],
      sparkline: generateMockSparkline('up'),
    },
    {
      id: 'energy',
      name: 'Oil & Energy',
      metric: '-15% vol',
      trend: 'down',
      active: false,
      tokens: ['USO', 'XOM'],
      sparkline: generateMockSparkline('down'),
    },
    {
      id: 'metals',
      name: 'Precious Metals',
      metric: '+45% vol',
      trend: 'up',
      active: false,
      tokens: ['GLD', 'SLV'],
      sparkline: generateMockSparkline('up'),
    },
  ],
};

function VolumeSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40;
  const h = 20;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' L ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendingNarratives({ category = 'all' }) {
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    setTrends(MOCK_NARRATIVES[category] || MOCK_NARRATIVES.all);
  }, [category]);

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
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Trending Narratives</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.t3, fontSize: 10, fontFamily: M }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Updated just now
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {trends.map((trend, idx) => (
          <div
            key={trend.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: trend.active ? C.b + '10' : 'transparent',
              borderRadius: 8,
              border: `1px solid ${trend.active ? C.b + '40' : C.bd}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!trend.active) e.currentTarget.style.background = C.sf;
            }}
            onMouseLeave={(e) => {
              if (!trend.active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t3, width: 16 }}>#{idx + 1}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, fontFamily: F }}>{trend.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {trend.tokens.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        color: C.t2,
                        background: C.sf,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: M,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, opacity: 0.8 }}>
                <VolumeSparkline data={trend.sparkline} color={trend.trend === 'up' ? C.up : C.dn} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: trend.trend === 'up' ? C.up : C.dn,
                  fontFamily: M,
                  background: (trend.trend === 'up' ? C.up : C.dn) + '15',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                {trend.metric}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(TrendingNarratives);
