// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Info Window (Sprint 12: Smart Crosshair)
// Redesigned: inline labels along crosshair lines instead of
// floating data box. Price+delta on horizontal, date on vertical.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { INDICATORS } from '../../../../charting_library/studies/indicators/registry.js';
import { logger } from '@/observability/logger';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import s from './ChartInfoWindow.module.css';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

export default function ChartInfoWindow({ data, barIdx, mouseY }) {
  const indicators = useChartToolsStore((st) => st.indicators);

  const bar = useMemo(() => {
    if (!data?.length || barIdx < 0 || barIdx >= data.length) return null;
    return data[barIdx];
  }, [data, barIdx]);

  const prevBar = useMemo(() => {
    if (!data?.length || barIdx <= 0 || barIdx >= data.length) return null;
    return data[barIdx - 1];
  }, [data, barIdx]);

  const indicatorValues = useMemo(() => {
    if (!bar || !indicators?.length || !data?.length) return [];
    const result = [];
    for (const ind of indicators) {
      if (ind.visible === false) continue;
      const regId = ind.indicatorId || ind.type;
      const def = INDICATORS[regId];
      if (!def?.compute || !def.outputs) continue;
      try {
        const computed = def.compute(data, ind.params || {});
        if (!computed) continue;
        for (const out of def.outputs) {
          const vals = computed[out.key];
          const val = vals && barIdx < vals.length ? vals[barIdx] : null;
          if (val != null && !isNaN(val)) {
            result.push({ label: `${def.shortName || regId}`, color: ind.color || out.color || '#AAA', value: val });
          }
        }
      } catch (e) { logger.ui.warn('Operation failed', e); }
    }
    return result;
  }, [bar, indicators, data, barIdx]);

  if (!bar) return null;

  const isUp = bar.close >= bar.open;
  const changeColor = isUp ? 'var(--tf-green)' : 'var(--tf-red)';
  const delta = prevBar ? bar.close - prevBar.close : 0;
  const deltaPct = prevBar?.close ? ((delta / prevBar.close) * 100) : 0;
  const isDeltaUp = delta >= 0;
  const deltaColor = isDeltaUp ? 'var(--tf-green)' : 'var(--tf-red)';

  return (
    <>
      <div className={`tf-fade-in ${s.pricePill}`} style={{ top: Math.max(4, Math.min((mouseY || 100) - 14, 600)) }}>
        <span className={s.priceValue} style={{ color: changeColor }}>{fmt(bar.close)}</span>
        {prevBar && (
          <>
            <span className={s.pipeSep} />
            <span className={s.deltaValue} style={{ color: deltaColor }}>{isDeltaUp ? '+' : ''}{fmt(delta)}</span>
            <span className={s.deltaPct} style={{ color: deltaColor }}>{isDeltaUp ? '+' : ''}{deltaPct.toFixed(2)}%</span>
          </>
        )}
      </div>

      {indicatorValues.length > 0 && (
        <div className={`tf-fade-in ${s.indicatorPill}`}>
          {indicatorValues.map((iv, i) => (
            <span key={i} className={s.indItem}>
              <span className={s.indDot} style={{ background: iv.color }} />
              <span className={s.indLabel}>{iv.label}</span>
              <span className={s.indValue} style={{ color: iv.color }}>{fmt(iv.value)}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
