// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Heatmap
//
// Treemap visualization: size = volume, color = probability change.
// Grouped by category. Apple-style clean visualization.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { CATEGORY_CONFIG } from '../../../data/schemas/PredictionMarketSchema.js';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionHeatmap.module.css';

// Simple treemap layout — squarified algorithm lite
function computeTreemapLayout(items, width, height) {
  if (!items.length) return [];

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  const rects = [];
  let x = 0,
    y = 0;
  let remainingWidth = width;
  let remainingHeight = height;
  let isHorizontal = width >= height;

  for (let i = 0; i < items.length; i++) {
    const ratio = items[i].value / totalValue;
    let w, h;

    if (isHorizontal) {
      w = remainingWidth * ratio * (items.length / (items.length - i));
      w = Math.min(w, remainingWidth);
      h = remainingHeight;
      rects.push({ ...items[i], x, y, w: Math.max(w, 0), h });
      x += w;
      remainingWidth -= w;
    } else {
      w = remainingWidth;
      h = remainingHeight * ratio * (items.length / (items.length - i));
      h = Math.min(h, remainingHeight);
      rects.push({ ...items[i], x, y, w, h: Math.max(h, 0) });
      y += h;
      remainingHeight -= h;
    }

    if (i % 3 === 2) isHorizontal = !isHorizontal;
  }

  return rects;
}

function getDeltaColor(delta) {
  if (delta >= 5) return 'rgba(34, 197, 94, 0.6)';
  if (delta > 0) return 'rgba(34, 197, 94, 0.25)';
  if (delta <= -5) return 'rgba(239, 68, 68, 0.6)';
  if (delta < 0) return 'rgba(239, 68, 68, 0.25)';
  return 'rgba(255, 255, 255, 0.06)';
}

export default memo(function PredictionHeatmap() {
  const markets = usePredictionStore((s) => s.markets);
  const openMarket = usePredictionDetailStore((s) => s.openMarket);

  const items = useMemo(() => {
    return markets
      .filter((m) => m.volume24h > 0)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 24)
      .map((m) => ({
        id: m.id,
        market: m,
        label: m.question.length > 40 ? m.question.slice(0, 37) + '...' : m.question,
        value: m.volume24h || 1,
        delta: m.change24h || 0,
        probability: m.outcomes?.[0]?.probability || 0,
        category: m.category,
      }));
  }, [markets]);

  const rects = useMemo(() => computeTreemapLayout(items, 100, 100), [items]);

  if (rects.length === 0) return null;

  return (
    <div className={styles.heatmap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Market Heatmap</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'rgba(34, 197, 94, 0.5)' }} /> Rising
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'rgba(239, 68, 68, 0.5)' }} /> Falling
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'rgba(255, 255, 255, 0.08)' }} /> Flat
          </span>
        </div>
      </div>
      <div className={styles.treemap}>
        {rects.map((rect) => {
          const _catCfg = CATEGORY_CONFIG[rect.category] || {};
          return (
            <div
              key={rect.id}
              className={styles.tile}
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
                background: getDeltaColor(rect.delta),
              }}
              onClick={() => {
                const allMarkets = usePredictionStore.getState().markets;
                openMarket(rect.market, allMarkets);
              }}
              title={`${rect.market.question}\n${rect.probability}% | ${rect.delta > 0 ? '+' : ''}${rect.delta}%`}
            >
              {rect.w > 12 && rect.h > 12 && (
                <div className={styles.tileContent}>
                  <span className={styles.tileLabel}>{rect.label}</span>
                  <span className={styles.tileProb}>{rect.probability}%</span>
                  <span
                    className={styles.tileDelta}
                    style={{ color: rect.delta > 0 ? '#22c55e' : rect.delta < 0 ? '#ef4444' : 'inherit' }}
                  >
                    {rect.delta > 0 ? '+' : ''}
                    {rect.delta}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
