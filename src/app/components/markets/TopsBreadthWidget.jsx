// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Market Breadth Widget
//
// Compact A/D breadth gauge surfacing DerivedDataEngine.computeMarketBreadth().
// Shows advancing/declining ratio as a horizontal bar + indicator label.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useState, useEffect } from 'react';
import { C } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import { derivedEngine } from '../../../data/DerivedDataEngine.js';
import styles from './TopsBreadthWidget.module.css';

const INDICATOR_LABELS = {
  strongly_bullish: 'Strong Bull',
  bullish: 'Bullish',
  neutral: 'Neutral',
  bearish: 'Bearish',
  strongly_bearish: 'Strong Bear',
};

const INDICATOR_COLORS = {
  strongly_bullish: '#34C759',
  bullish: '#30D158',
  neutral: '#F0B64E',
  bearish: '#FF6B6B',
  strongly_bearish: '#FF3B30',
};

export default memo(function TopsBreadthWidget() {
  const markets = useTopMarketsStore((s) => s.markets);
  const [breadth, setBreadth] = useState(null);

  useEffect(() => {
    if (!markets.length) return;

    // Build quote objects from market data
    const quotes = markets
      .filter((m) => m.change24h != null)
      .map((m) => ({
        symbol: m.symbol,
        changePct: m.change24h,
        volume: m.volume24h || 0,
      }));

    if (quotes.length < 5) return;

    try {
      const result = derivedEngine.computeMarketBreadth(quotes);
      setBreadth(result);
    } catch {
      // DerivedDataEngine may not have ticks loaded — fallback calculation
      let adv = 0, dec = 0, unch = 0;
      for (const q of quotes) {
        if (q.changePct > 0) adv++;
        else if (q.changePct < 0) dec++;
        else unch++;
      }
      const total = adv + dec + unch;
      const ratio = total > 0 ? Math.round((adv / total) * 1000) / 1000 : 0.5;
      const indicator = ratio > 0.65 ? 'strongly_bullish' : ratio > 0.55 ? 'bullish' : ratio > 0.45 ? 'neutral' : ratio > 0.35 ? 'bearish' : 'strongly_bearish';
      setBreadth({ advancing: adv, declining: dec, unchanged: unch, total, ratio, indicator });
    }
  }, [markets]);

  if (!breadth || breadth.total < 5) return null;

  const advPct = Math.round((breadth.advancing / breadth.total) * 100);
  const decPct = Math.round((breadth.declining / breadth.total) * 100);
  const color = INDICATOR_COLORS[breadth.indicator] || '#F0B64E';

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.title}>Market Breadth</span>
        <span className={styles.indicator} style={{ color }}>
          {INDICATOR_LABELS[breadth.indicator] || 'Neutral'}
        </span>
      </div>

      {/* A/D Bar */}
      <div className={styles.barTrack}>
        <div
          className={styles.barAdvancing}
          style={{ width: `${advPct}%` }}
        />
      </div>

      <div className={styles.stats}>
        <span className={styles.statUp}>
          {breadth.advancing} advancing ({advPct}%)
        </span>
        <span className={styles.statDown}>
          {breadth.declining} declining ({decPct}%)
        </span>
      </div>
    </div>
  );
});
