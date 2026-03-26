// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Upcoming Earnings Strip
//
// Compact horizontal strip showing upcoming earnings for visible stocks.
// Surfaces existing EarningsService.getUpcomingEarnings().
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect, useState, useMemo } from 'react';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import styles from './TopsEarningsStrip.module.css';

export default memo(function TopsEarningsStrip() {
  const markets = useTopMarketsStore((s) => s.markets);
  const [earnings, setEarnings] = useState([]);

  // Extract stock symbols for earnings lookup
  const stockSymbols = useMemo(() => {
    return markets
      .filter((m) => m.assetClass === 'stock' || m.assetClass === 'etf')
      .map((m) => m.symbol)
      .slice(0, 40);
  }, [markets]);

  useEffect(() => {
    if (!stockSymbols.length) return;
    let cancelled = false;

    (async () => {
      try {
        const { getUpcomingEarnings } = await import('../../../services/EarningsService.js');
        const results = await getUpcomingEarnings(stockSymbols, 14);
        if (!cancelled) setEarnings(results || []);
      } catch {
        // Service may not be available
      }
    })();

    return () => { cancelled = true; };
  }, [stockSymbols]);

  if (!earnings.length) return null;

  return (
    <div className={styles.container}>
      <span className={styles.label}>Upcoming Earnings</span>
      <div className={styles.scroll}>
        {earnings.map((e) => (
          <div key={e.symbol} className={styles.chip}>
            <span className={styles.chipSymbol}>{e.symbol}</span>
            <span className={styles.chipDate}>
              {formatDate(e.nextDate)} {e.time === 'BMO' ? 'Pre' : 'Post'}
            </span>
            {e.epsEstimate != null && (
              <span className={styles.chipEps}>
                Est ${e.epsEstimate.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
