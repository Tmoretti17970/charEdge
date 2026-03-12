// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — No Data State
// Full empty state shown when chart has no data available.
// Explains why and provides CTA to add an API key.
// ═══════════════════════════════════════════════════════════════════


import { memo } from 'react';
const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 40,
  textAlign: 'center',
  height: '100%',
  minHeight: 300,
};

const iconStyle = {
  fontSize: 48,
  opacity: 0.4,
  lineHeight: 1,
};

const titleStyle = {
  font: 'var(--tf-type-lg)',
  color: 'var(--tf-t1)',
  margin: 0,
};

const descStyle = {
  font: 'var(--tf-type-md)',
  color: 'var(--tf-t3)',
  maxWidth: 360,
  lineHeight: 1.5,
  margin: 0,
};

const ctaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid var(--tf-bd)',
  background: 'var(--tf-sf)',
  color: 'var(--tf-accent)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--tf-font)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

/**
 * Empty state for charts with no data.
 * @param {{ symbol: string, onSettingsClick?: () => void }} props
 */
function NoDataState({ symbol, onSettingsClick }) {
  return (
    <div style={containerStyle} className="tf-fade-in-up">
      <div style={iconStyle}>📊</div>
      <h3 style={titleStyle}>No data available for {symbol || 'this symbol'}</h3>
      <p style={descStyle}>
        Real-time data is available for crypto via Binance.
        For stocks, futures, and forex, add a <strong>Polygon.io</strong> API key in Settings.
      </p>
      {onSettingsClick && (
        <button
          style={ctaStyle}
          onClick={onSettingsClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--tf-accent)';
            e.currentTarget.style.background = 'var(--tf-sf2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--tf-bd)';
            e.currentTarget.style.background = 'var(--tf-sf)';
          }}
        >
          ⚙️ Open Settings
        </button>
      )}
    </div>
  );
}

export default memo(NoDataState);
