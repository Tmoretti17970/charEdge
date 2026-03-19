// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Data Quality Indicator
//
// Compact badge showing price aggregation quality:
//   [●●○ High] or [●○○ Low] with source count and spread
//
// Sits next to the LiveTicker or in the chart toolbar.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '@/constants.js';
import { CONFIDENCE } from '../../../../data/engine/streaming/PriceAggregator.js';

let _confidenceConfig = null;
function getConfidenceConfig() {
  if (!_confidenceConfig) {
    _confidenceConfig = {
      [CONFIDENCE.HIGH]: {
        color: C.g,
        dots: 3,
        label: 'High',
        tooltip: 'Price confirmed by 3+ sources',
      },
      [CONFIDENCE.MEDIUM]: {
        color: '#f0b64e',
        dots: 2,
        label: 'Med',
        tooltip: 'Price from 2 sources',
      },
      [CONFIDENCE.LOW]: {
        color: '#e8642c',
        dots: 1,
        label: 'Low',
        tooltip: 'Single source — limited confidence',
      },
      [CONFIDENCE.STALE]: {
        color: '#666',
        dots: 0,
        label: 'Stale',
        tooltip: 'No fresh data — showing last known price',
      },
    };
  }
  return _confidenceConfig;
}

function ConfidenceDots({ count, color }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: i < count ? color : 'rgba(255,255,255,0.12)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

export function DataQualityIndicator({ confidence, sourceCount, spread, sources }) {
  const config = getConfidenceConfig()[confidence] || getConfidenceConfig()[CONFIDENCE.STALE];

  // Don't render if no aggregation data
  if (!confidence) return null;

  const spreadStr = spread > 0
    ? `$${spread < 1 ? spread.toFixed(4) : spread.toFixed(2)} spread`
    : '';

  const sourceList = sources?.length > 0
    ? sources.join(', ')
    : 'none';

  return (
    <div
      title={`${config.tooltip}\nSources: ${sourceList}${spreadStr ? '\n' + spreadStr : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'default',
        userSelect: 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <ConfidenceDots count={config.dots} color={config.color} />

      <span
        style={{
          fontSize: 9,
          fontFamily: F,
          fontWeight: 600,
          color: config.color,
          letterSpacing: '0.3px',
        }}
      >
        {config.label}
      </span>

      {sourceCount > 0 && (
        <span
          style={{
            fontSize: 8,
            fontFamily: F,
            color: C.t3,
            marginLeft: 1,
          }}
        >
          {sourceCount}×
        </span>
      )}
    </div>
  );
}

/**
 * Minimal inline variant for space-constrained areas.
 */
export function DataQualityDot({ confidence }) {
  const config = getConfidenceConfig()[confidence] || getConfidenceConfig()[CONFIDENCE.STALE];
  if (!confidence) return null;

  return (
    <div
      title={config.tooltip}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: config.color,
        boxShadow: confidence === CONFIDENCE.HIGH ? `0 0 4px ${config.color}` : 'none',
        flexShrink: 0,
      }}
    />
  );
}

export default React.memo(DataQualityIndicator);
