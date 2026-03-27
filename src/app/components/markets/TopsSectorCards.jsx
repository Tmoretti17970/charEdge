// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Sector Performance Cards
//
// Apple-style horizontal scrolling cards showing GICS sector
// performance using sector ETF proxies (XLK, XLF, XLE, etc.).
// Each card: sector name, % change, color indicator.
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect, useState, useCallback } from 'react';
import styles from './TopsSectorCards.module.css';

const SECTORS = [
  { symbol: 'XLK', label: 'Tech', color: '#5856D6' },
  { symbol: 'XLF', label: 'Financial', color: '#007AFF' },
  { symbol: 'XLE', label: 'Energy', color: '#FF9500' },
  { symbol: 'XLV', label: 'Health', color: '#34C759' },
  { symbol: 'XLI', label: 'Industrial', color: '#8E8E93' },
  { symbol: 'XLP', label: 'Staples', color: '#AF52DE' },
  { symbol: 'XLY', label: 'Discretion.', color: '#FF2D55' },
  { symbol: 'XLB', label: 'Materials', color: '#A2845E' },
  { symbol: 'XLU', label: 'Utilities', color: '#30D158' },
  { symbol: 'XLRE', label: 'Real Estate', color: '#64D2FF' },
  { symbol: 'XLC', label: 'Comms', color: '#FF375F' },
];

export default memo(function TopsSectorCards() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSectors = useCallback(async () => {
    try {
      const { batchGetQuotes } = await import('../../../data/QuoteService.js');
      const symbols = SECTORS.map((s) => s.symbol);
      const quotes = await batchGetQuotes(symbols);

      const results = SECTORS.map((s) => {
        const q = quotes?.[s.symbol];
        return {
          ...s,
          change: q?.changePct ?? q?.priceChangePercent ?? null,
          price: q?.price || q?.lastPrice || null,
        };
      }).filter((s) => s.change != null);

      setSectors(results);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSectors();
    const id = setInterval(fetchSectors, 120_000);
    return () => clearInterval(id);
  }, [fetchSectors]);

  if (loading || sectors.length === 0) return null;

  return (
    <div className={styles.container}>
      <span className={styles.sectionLabel}>Sectors</span>
      <div className={styles.scroll}>
        {sectors.map((sector) => {
          const isUp = (sector.change || 0) >= 0;
          const changeColor = isUp ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)';
          return (
            <div key={sector.symbol} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.dot} style={{ background: sector.color }} />
                <span className={styles.cardLabel}>{sector.label}</span>
              </div>
              <span className={styles.cardChange} style={{ color: changeColor }}>
                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}
                {sector.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
