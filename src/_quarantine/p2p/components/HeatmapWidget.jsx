import React from 'react';
import { C, F, M } from '../../../constants.js';

// Top 10 mock assets for the heatmap
const HEATMAP_DATA = [
  { symbol: 'BTC', name: 'Bitcoin', mcap: 1200, change24h: 2.45, row: 1, colSpan: 3, rowSpan: 2 },
  { symbol: 'ETH', name: 'Ethereum', mcap: 400, change24h: 3.12, row: 1, colSpan: 2, rowSpan: 2 },
  { symbol: 'BNB', name: 'BNB', mcap: 80, change24h: -1.2, row: 1, colSpan: 1, rowSpan: 1 },
  { symbol: 'SOL', name: 'Solana', mcap: 65, change24h: 8.4, row: 2, colSpan: 1, rowSpan: 1 },
  { symbol: 'XRP', name: 'XRP', mcap: 35, change24h: 0.5, row: 3, colSpan: 1, rowSpan: 1 },
  { symbol: 'ADA', name: 'Cardano', mcap: 22, change24h: -2.3, row: 3, colSpan: 1, rowSpan: 1 },
  { symbol: 'AVAX', name: 'Avalanche', mcap: 18, change24h: -4.1, row: 3, colSpan: 1, rowSpan: 1 },
  { symbol: 'DOGE', name: 'Dogecoin', mcap: 16, change24h: 1.2, row: 3, colSpan: 1, rowSpan: 1 },
  { symbol: 'DOT', name: 'Polkadot', mcap: 12, change24h: 0.8, row: 3, colSpan: 1, rowSpan: 1 },
  { symbol: 'LINK', name: 'Chainlink', mcap: 10, change24h: 4.5, row: 3, colSpan: 1, rowSpan: 1 },
];

function getHeatmapColor(change) {
  if (change >= 5) return '#059669'; // strong green
  if (change >= 2) return '#10b981'; // mid green
  if (change > 0) return '#34d399'; // light green
  if (change === 0) return '#64748b'; // neutral
  if (change > -2) return '#fb7185'; // light red
  if (change > -5) return '#f43f5e'; // mid red
  return '#e11d48'; // strong red
}

function HeatmapWidget() {
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>🟩 Market Heatmap</h3>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>Updated just now</span>
      </div>

      {/* Grid Layout (Mocking a Treemap) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridTemplateRows: 'repeat(3, 100px)',
          gap: 4,
          width: '100%',
        }}
      >
        {HEATMAP_DATA.map((asset) => {
          const bgColor = getHeatmapColor(asset.change24h);
          const isPositive = asset.change24h >= 0;

          return (
            <div
              key={asset.symbol}
              style={{
                gridColumn: `span ${asset.colSpan}`,
                gridRow: `span ${asset.rowSpan}`,
                background: bgColor,
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div
                style={{
                  fontSize: asset.colSpan > 1 ? 24 : 14,
                  fontWeight: 800,
                  fontFamily: F,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {asset.symbol}
              </div>
              <div
                style={{
                  fontSize: asset.colSpan > 1 ? 16 : 11,
                  fontWeight: 600,
                  fontFamily: M,
                  opacity: 0.9,
                  marginTop: asset.colSpan > 1 ? 4 : 2,
                }}
              >
                {isPositive ? '+' : ''}
                {asset.change24h}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(HeatmapWidget);
