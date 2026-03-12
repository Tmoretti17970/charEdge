import React from 'react';
import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const MOCK_FUNDING = [
  { pair: 'BTCUSDT', rate: 0.01, predicted: 0.0085, oi: '18.2B' },
  { pair: 'ETHUSDT', rate: 0.008, predicted: 0.0072, oi: '8.4B' },
  { pair: 'SOLUSDT', rate: 0.021, predicted: 0.018, oi: '2.1B' },
  { pair: 'DOGEUSDT', rate: -0.005, predicted: -0.0032, oi: '890M' },
  { pair: 'XRPUSDT', rate: 0.0042, predicted: 0.0055, oi: '1.3B' },
  { pair: 'AVAXUSDT', rate: -0.012, predicted: -0.009, oi: '420M' },
  { pair: 'ARBUSDT', rate: 0.015, predicted: 0.013, oi: '310M' },
  { pair: 'OPUSDT', rate: 0.0065, predicted: 0.0048, oi: '280M' },
];

function FundingRatesWidget() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setRates(MOCK_FUNDING);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.t3,
          fontSize: 13,
        }}
      >
        Loading funding rates...
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Funding Rates</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>8h interval</span>
      </div>

      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 80px 70px',
          gap: 8,
          padding: '0 4px',
          fontSize: 10,
          fontWeight: 700,
          color: C.t3,
          fontFamily: M,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        <span>Pair</span>
        <span style={{ textAlign: 'right' }}>Rate</span>
        <span style={{ textAlign: 'right' }}>Predicted</span>
        <span style={{ textAlign: 'right' }}>OI</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rates.map((r) => {
          const isPositive = r.rate >= 0;
          const color = isPositive ? C.g : C.r;
          const predColor = r.predicted >= 0 ? C.g : C.r;

          return (
            <div
              key={r.pair}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 70px',
                gap: 8,
                padding: '8px 4px',
                borderRadius: 6,
                transition: 'background 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = alpha(C.t3, 0.06))}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M }}>
                {r.pair.replace('USDT', '')}
                <span style={{ color: C.t3, fontWeight: 400 }}>/USDT</span>
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: M,
                  color,
                }}
              >
                {isPositive ? '+' : ''}
                {r.rate.toFixed(4)}%
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: M,
                  color: predColor,
                  opacity: 0.7,
                }}
              >
                {r.predicted >= 0 ? '+' : ''}
                {r.predicted.toFixed(4)}%
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontSize: 11,
                  color: C.t2,
                  fontFamily: M,
                  fontWeight: 600,
                }}
              >
                ${r.oi}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 10,
          color: C.t3,
          fontFamily: F,
          paddingTop: 8,
          borderTop: `1px solid ${C.bd}`,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.g }} />
          Longs paying shorts
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.r }} />
          Shorts paying longs
        </span>
      </div>
    </div>
  );
}

export default React.memo(FundingRatesWidget);
