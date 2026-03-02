// ═══════════════════════════════════════════════════════════════════
// MetricInfo — Tooltip Definitions for Financial Metrics
//
// Displays an ⓘ icon that reveals a tooltip explaining trading
// metrics. Uses the tf-metric-tooltip CSS class from components.css.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import { C, F } from '../../../constants.js';

// ─── Metric Definitions ─────────────────────────────────────────

export const METRIC_DEFINITIONS = {
  sharpe: {
    name: 'Sharpe Ratio',
    description: 'Risk-adjusted return per unit of total volatility. Higher is better; >1 is good, >2 is very good.',
    formula: '(Return − Risk-Free Rate) ÷ Std Dev of Returns',
  },
  sortino: {
    name: 'Sortino Ratio',
    description: 'Like Sharpe, but only penalizes downside volatility. Better for strategies with asymmetric returns.',
    formula: '(Return − Risk-Free Rate) ÷ Downside Std Dev',
  },
  profitFactor: {
    name: 'Profit Factor',
    description: 'Gross profit divided by gross loss. >1 means profitable overall; >2 is strong.',
    formula: 'Σ Winning Trades ÷ |Σ Losing Trades|',
  },
  maxDrawdown: {
    name: 'Max Drawdown',
    description: 'Largest peak-to-trough decline in account equity. Measures worst-case loss exposure.',
    formula: '(Peak − Trough) ÷ Peak × 100%',
  },
  winRate: {
    name: 'Win Rate',
    description: 'Percentage of trades that are profitable. Higher is better, but must be paired with R:R ratio.',
    formula: 'Winning Trades ÷ Total Trades × 100%',
  },
  kelly: {
    name: 'Kelly Criterion',
    description: 'Optimal position size to maximize long-term growth. Conservative traders use half-Kelly.',
    formula: 'W − (1 − W) ÷ R  (W = win rate, R = win/loss ratio)',
  },
  expectancy: {
    name: 'Expectancy',
    description: 'Average amount you expect to win or lose per trade. Positive expectancy = edge.',
    formula: '(Win Rate × Avg Win) − (Loss Rate × Avg Loss)',
  },
  rMultiple: {
    name: 'R-Multiple',
    description: 'Trade P&L expressed as a multiple of initial risk (R). +2R = made 2× your risk.',
    formula: 'P&L ÷ Initial Risk (R)',
  },
};

// ─── MetricInfo Component ───────────────────────────────────────

/**
 * Inline tooltip icon that explains a trading metric on hover/focus.
 *
 * @param {Object} props
 * @param {string} props.metric - Key from METRIC_DEFINITIONS (e.g. 'sharpe')
 * @param {'top'|'bottom'} [props.position='bottom'] - Tooltip position
 * @param {Object} [props.style] - Additional styles
 */
export function MetricInfo({ metric, position = 'bottom', style = {} }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef(null);
  const def = METRIC_DEFINITIONS[metric];

  if (!def) return null;

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setShow(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setShow(false), 120);
  };

  return (
    <span
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      tabIndex={0}
      role="button"
      aria-label={`Learn about ${def.name}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'help',
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: F,
          color: C.t3,
          opacity: 0.7,
          transition: 'opacity 0.15s',
          ...(show ? { opacity: 1, color: C.b } : {}),
        }}
      >
        ⓘ
      </span>

      {show && (
        <div
          className="tf-metric-tooltip"
          style={{
            position: 'absolute',
            [position === 'top' ? 'bottom' : 'top']: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: position === 'bottom' ? 6 : 0,
            marginBottom: position === 'top' ? 6 : 0,
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 10,
            padding: '10px 14px',
            width: 260,
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: F,
              color: C.t1,
              marginBottom: 4,
            }}
          >
            {def.name}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: F,
              color: C.t2,
              lineHeight: 1.5,
              marginBottom: def.formula ? 6 : 0,
            }}
          >
            {def.description}
          </div>
          {def.formula && (
            <div
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: C.t3,
                background: C.bg2,
                borderRadius: 6,
                padding: '4px 8px',
                lineHeight: 1.4,
              }}
            >
              {def.formula}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

export default MetricInfo;
