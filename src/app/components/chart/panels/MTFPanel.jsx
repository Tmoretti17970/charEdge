// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Timeframe (MTF) Panel
// Renders 2-3 ChartEngineWidgets side-by-side at different timeframes
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import ChartEngineWidget from '../core/ChartEngineWidget.jsx';
import { useChartStore } from '../../../../state/useChartStore.js';
import { TFS } from '../../../../constants.js';

const styles = {
  container: {
    display: 'flex', gap: 4, width: '100%',
    background: '#131722',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: 4,
    boxSizing: 'border-box',
  },
  chartWrapper: {
    flex: 1, minWidth: 0,
    background: '#1E222D', borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '4px 8px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.02)',
  },
  tfLabel: {
    fontSize: 11, fontWeight: 700,
    color: '#D1D4DC', textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
  chartBody: {
    flex: 1, minHeight: 200,
  },
  controls: {
    display: 'flex', gap: 4, padding: '4px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.01)',
  },
  tfBtn: {
    padding: '2px 8px', borderRadius: 4, border: 'none',
    fontSize: 10, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tfBtnActive: {
    background: 'rgba(41, 98, 255, 0.3)', color: '#4B8BFF',
  },
  tfBtnInactive: {
    background: 'rgba(255,255,255,0.04)', color: '#787B86',
  },
};

const DEFAULT_TFS = ['15m', '1h', '4h'];
const ALL_TF_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

/**
 * Multi-Timeframe Analysis Panel.
 * Shows the same symbol at 2-3 different timeframes side by side.
 *
 * @param {Object} props
 * @param {string} props.symbol - Active symbol
 * @param {string[]} [props.timeframes] - Array of timeframes to display
 * @param {Object} [props.theme] - Theme object
 * @param {number} [props.height] - Height in pixels (default: 300)
 */
export default function MTFPanel({ symbol, timeframes: propTfs, theme, height = 300 }) {
  const [timeframes, setTimeframes] = useState(propTfs || DEFAULT_TFS);

  const handleTFChange = (idx, newTf) => {
    const updated = [...timeframes];
    updated[idx] = newTf;
    setTimeframes(updated);
  };

  const addTF = () => {
    if (timeframes.length >= 4) return;
    // Add next logical timeframe
    const nextTf = ALL_TF_OPTIONS.find(tf => !timeframes.includes(tf)) || '1D';
    setTimeframes([...timeframes, nextTf]);
  };

  const removeTF = (idx) => {
    if (timeframes.length <= 2) return;
    setTimeframes(timeframes.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ ...styles.container, height }}>
      {timeframes.map((tf, idx) => (
        <div key={`mtf-${tf}-${idx}`} style={styles.chartWrapper}>
          <div style={styles.header}>
            <span style={styles.tfLabel}>{symbol} · {tf}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <select
                value={tf}
                onChange={(e) => handleTFChange(idx, e.target.value)}
                style={{
                  background: '#131722', color: '#D1D4DC',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4, fontSize: 10, padding: '1px 4px',
                  cursor: 'pointer',
                }}
              >
                {ALL_TF_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {timeframes.length > 2 && (
                <button
                  onClick={() => removeTF(idx)}
                  style={{
                    background: 'none', border: 'none',
                    color: '#787B86', cursor: 'pointer', fontSize: 12,
                    padding: '0 2px',
                  }}
                  title="Remove"
                >×</button>
              )}
            </div>
          </div>
          <div style={styles.chartBody}>
            <ChartEngineWidget
              symbol={symbol}
              tf={tf}
              compact={true}
              theme={theme}
            />
          </div>
        </div>
      ))}
      {timeframes.length < 4 && (
        <button
          onClick={addTF}
          style={{
            width: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 6, color: '#787B86', cursor: 'pointer',
            fontSize: 18, flexShrink: 0,
          }}
          title="Add timeframe"
        >+</button>
      )}
    </div>
  );
}
