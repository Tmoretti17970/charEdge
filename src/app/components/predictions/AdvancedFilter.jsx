// ═══════════════════════════════════════════════════════════════════
// charEdge — Advanced Filter Builder
//
// Power-user query builder with probability range, volume threshold,
// source selection, and custom date range. Apple-style compact form.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback } from 'react';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './AdvancedFilter.module.css';

export default memo(function AdvancedFilter({ onClose }) {
  const clearAllFilters = usePredictionStore((s) => s.clearAllFilters);

  const [probMin, setProbMin] = useState(0);
  const [probMax, setProbMax] = useState(100);
  const [minVolume, setMinVolume] = useState('');
  const [outcomeCount, setOutcomeCount] = useState('any'); // 'any' | 'binary' | 'multi'

  const handleApply = useCallback(() => {
    // Apply filters through the store's search query as a structured filter
    // This is a simplified version — in production, the store would support structured queries
    const parts = [];
    if (probMin > 0) parts.push(`prob>${probMin}`);
    if (probMax < 100) parts.push(`prob<${probMax}`);
    if (minVolume) parts.push(`vol>${minVolume}`);
    if (outcomeCount !== 'any') parts.push(`type:${outcomeCount}`);

    // For now, we use the search query to signal advanced filters
    // A proper implementation would add these to the store as structured filters
    if (parts.length > 0) {
      usePredictionStore.getState().setSearchQuery(parts.join(' '));
    }
    if (onClose) onClose();
  }, [probMin, probMax, minVolume, outcomeCount, onClose]);

  const handleClear = useCallback(() => {
    setProbMin(0);
    setProbMax(100);
    setMinVolume('');
    setOutcomeCount('any');
    clearAllFilters();
    if (onClose) onClose();
  }, [clearAllFilters, onClose]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Advanced Filters</h3>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Probability range */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Probability Range</label>
        <div className={styles.rangeRow}>
          <input
            type="number"
            className={styles.numInput}
            value={probMin}
            onChange={(e) => setProbMin(Math.max(0, Math.min(100, Number(e.target.value))))}
            min={0}
            max={100}
            placeholder="0"
          />
          <span className={styles.rangeSep}>to</span>
          <input
            type="number"
            className={styles.numInput}
            value={probMax}
            onChange={(e) => setProbMax(Math.max(0, Math.min(100, Number(e.target.value))))}
            min={0}
            max={100}
            placeholder="100"
          />
          <span className={styles.rangeUnit}>%</span>
        </div>
      </div>

      {/* Minimum volume */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Minimum 24h Volume</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputPrefix}>$</span>
          <input
            type="number"
            className={styles.textInput}
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
            placeholder="Any"
          />
        </div>
      </div>

      {/* Market type */}
      <div className={styles.filterGroup}>
        <label className={styles.label}>Market Type</label>
        <div className={styles.pillRow}>
          {[
            { id: 'any', label: 'Any' },
            { id: 'binary', label: 'Binary (Yes/No)' },
            { id: 'multi', label: 'Multi-outcome' },
          ].map((opt) => (
            <button
              key={opt.id}
              className={`${styles.pill} ${outcomeCount === opt.id ? styles.pillActive : ''}`}
              onClick={() => setOutcomeCount(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.clearBtn} onClick={handleClear}>
          Clear All
        </button>
        <button className={styles.applyBtn} onClick={handleApply}>
          Apply Filters
        </button>
      </div>
    </div>
  );
});
