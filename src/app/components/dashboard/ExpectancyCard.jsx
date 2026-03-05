// ═══════════════════════════════════════════════════════════════════
// charEdge — ExpectancyCard (Task 6.5.4)
//
// Dashboard widget displaying trade expectancy:
// - R-multiple expectancy: (Win% × Avg Win R) − (Loss% × Avg Loss R)
// - Dollar expectancy: (Win% × Avg Win $) − (Loss% × Avg Loss $)
// - "Walking liquidation" warning when negative
// ═══════════════════════════════════════════════════════════════════

import useAnalyticsStore from '../../../state/useAnalyticsStore.js';

const CARD_STYLE = {
  background: 'rgba(20, 20, 30, 0.6)',
  backdropFilter: 'blur(16px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '16px',
  padding: '20px',
  minWidth: '260px',
};

const LABEL_STYLE = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '8px',
  fontFamily: 'var(--forge-font, Inter, sans-serif)',
};

const VALUE_STYLE = {
  fontSize: '28px',
  fontWeight: 700,
  fontFamily: 'var(--forge-font, Inter, sans-serif)',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
  marginBottom: '4px',
};

const SUB_STYLE = {
  fontSize: '13px',
  color: 'rgba(255, 255, 255, 0.5)',
  fontFamily: 'var(--forge-font, Inter, sans-serif)',
  fontVariantNumeric: 'tabular-nums',
};

const WARNING_STYLE = {
  marginTop: '10px',
  padding: '6px 10px',
  borderRadius: '8px',
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  fontSize: '11px',
  fontWeight: 600,
  color: '#fca5a5',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

function ExpectancyCard() {
  const result = useAnalyticsStore((s) => s.result);
  const expectancy = result?.expectancyDetail;

  // If no data yet, show placeholder
  if (!expectancy || expectancy.sampleSize < 5) {
    return (
      <div style={CARD_STYLE}>
        <div style={LABEL_STYLE}>Expectancy</div>
        <div style={{ ...VALUE_STYLE, color: 'rgba(255,255,255,0.2)' }}>—</div>
        <div style={SUB_STYLE}>
          {expectancy ? `${expectancy.sampleSize}/5 trades needed` : 'Log trades to see expectancy'}
        </div>
      </div>
    );
  }

  const isNegative = expectancy.isNegative;
  const color = isNegative ? '#f87171' : '#34d399';
  const sign = expectancy.value >= 0 ? '+' : '';

  return (
    <div style={CARD_STYLE}>
      <div style={LABEL_STYLE}>Expectancy</div>

      {/* R-Multiple Expectancy */}
      <div style={{ ...VALUE_STYLE, color }}>
        {sign}
        {expectancy.value.toFixed(2)}R
      </div>

      {/* Dollar Expectancy */}
      <div style={SUB_STYLE}>
        {sign}${expectancy.dollarValue.toFixed(2)} per trade
        <span style={{ marginLeft: '8px', opacity: 0.5 }}>({expectancy.sampleSize} trades)</span>
      </div>

      {/* Walking Liquidation Warning */}
      {isNegative && (
        <div style={WARNING_STYLE}>
          <span>⚠️</span>
          <span>Negative expectancy — you're losing money per trade on average</span>
        </div>
      )}
    </div>
  );
}

export { ExpectancyCard };
export default ExpectancyCard;
