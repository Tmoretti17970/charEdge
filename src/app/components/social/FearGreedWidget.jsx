import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// Mock Fear & Greed data — replace with API (alternative.me/crypto/fear-and-greed-index/)
const MOCK_FG_DATA = {
  value: 68,
  label: 'Greed',
  previousClose: 62,
  history: [45, 42, 48, 52, 55, 61, 58, 63, 65, 60, 55, 58, 62, 68],
  lastUpdated: new Date().toISOString(),
};

function getGradientColor(value) {
  if (value <= 20) return '#e74c3c';
  if (value <= 40) return '#e67e22';
  if (value <= 60) return '#f1c40f';
  if (value <= 80) return '#2ecc71';
  return '#27ae60';
}

function getLabel(value) {
  if (value <= 20) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 80) return 'Greed';
  return 'Extreme Greed';
}

function GaugeArc({ value, size = 140 }) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 12;
  const startAngle = Math.PI;
  const endAngle = 0;
  const valueAngle = startAngle - (value / 100) * Math.PI;

  const arcPath = (start, end) => {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  const needleX = cx + (radius - 8) * Math.cos(valueAngle);
  const needleY = cy + (radius - 8) * Math.sin(valueAngle);
  const color = getGradientColor(value);

  return (
    <svg width={size} height={size / 2 + 25} viewBox={`0 0 ${size} ${size / 2 + 25}`}>
      <defs>
        <linearGradient id="fgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e74c3c" />
          <stop offset="25%" stopColor="#e67e22" />
          <stop offset="50%" stopColor="#f1c40f" />
          <stop offset="75%" stopColor="#2ecc71" />
          <stop offset="100%" stopColor="#27ae60" />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke={alpha(C.t3, 0.15)}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={arcPath(startAngle, valueAngle)}
        fill="none"
        stroke="url(#fgGradient)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={color} />
      {/* Value text */}
      <text x={cx} y={cy - 14} textAnchor="middle" fill={C.t1} fontSize="28" fontWeight="800" fontFamily={M}>
        {value}
      </text>
    </svg>
  );
}

function Sparkline({ data, width = 140, height = 32 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const lastVal = data[data.length - 1];
  const firstVal = data[0];
  const color = lastVal >= firstVal ? C.g : C.r;

  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function FearGreedWidget() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => setData(MOCK_FG_DATA), 400);
  }, []);

  if (!data) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3 }}>
        Loading Fear & Greed...
      </div>
    );
  }

  const change = data.value - data.previousClose;
  const color = getGradientColor(data.value);

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Fear & Greed Index</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Updated just now</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <GaugeArc value={data.value} />
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color,
            marginTop: -4,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontFamily: F,
          }}
        >
          {getLabel(data.value)}
        </div>
        <div style={{ fontSize: 12, color: change >= 0 ? C.g : C.r, fontWeight: 600, marginTop: 4, fontFamily: M }}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)} from yesterday
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          background: C.sf,
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 11, color: C.t3, fontWeight: 600, fontFamily: F }}>14-Day Trend</span>
        <Sparkline data={data.history} />
      </div>
    </div>
  );
}
