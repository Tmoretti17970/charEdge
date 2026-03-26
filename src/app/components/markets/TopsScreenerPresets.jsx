// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Screener Presets
//
// Quick-access buttons for existing SmartScreener presets.
// Surfaces screenerService.js preset scans inline in the Tops tab.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback } from 'react';
import styles from './TopsScreenerPresets.module.css';

const PRESETS = [
  { id: 'breakout', label: 'Breakout', icon: '↗', color: '#34C759' },
  { id: 'oversold', label: 'Oversold', icon: '↘', color: '#FF3B30' },
  { id: 'volume', label: 'Unusual Vol', icon: '◉', color: '#AF52DE' },
  { id: 'momentum', label: 'Momentum', icon: '⚡', color: '#FF9F0A' },
  { id: 'whale', label: 'Whale Accum', icon: '🐋', color: '#5AC8FA' },
  { id: 'crossover', label: 'MA Cross', icon: '✕', color: '#FFD60A' },
];

export default memo(function TopsScreenerPresets() {
  const [activePreset, setActivePreset] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runPreset = useCallback(async (presetId) => {
    if (activePreset === presetId) {
      setActivePreset(null);
      setResults([]);
      return;
    }

    setActivePreset(presetId);
    setLoading(true);

    try {
      const { runPresetScan } = await import('../../../services/screenerService.js');
      const res = await runPresetScan(presetId);
      setResults(res || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activePreset]);

  return (
    <div className={styles.container}>
      <span className={styles.label}>Quick Scans</span>
      <div className={styles.presetRow}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`${styles.preset} ${activePreset === p.id ? styles.presetActive : ''}`}
            style={{
              '--preset-color': p.color,
              borderColor: activePreset === p.id ? p.color : undefined,
            }}
            onClick={() => runPreset(p.id)}
          >
            <span className={styles.presetIcon}>{p.icon}</span>
            {p.label}
            {activePreset === p.id && results.length > 0 && (
              <span className={styles.badge}>{results.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Results strip */}
      {activePreset && results.length > 0 && (
        <div className={styles.resultsRow}>
          {results.slice(0, 10).map((r) => (
            <span key={r.symbol} className={styles.resultChip}>
              {r.symbol}
              {r.changePct != null && (
                <span style={{ color: r.changePct >= 0 ? '#34C759' : '#FF3B30' }}>
                  {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {activePreset && loading && (
        <div className={styles.resultsRow}>
          <span className={styles.loadingText}>Scanning...</span>
        </div>
      )}
    </div>
  );
});
