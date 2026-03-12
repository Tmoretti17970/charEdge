// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Info Window (Sprint 12: Smart Crosshair)
// Redesigned: inline labels along crosshair lines instead of
// floating data box. Price+delta on horizontal, date on vertical.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { INDICATORS } from '../../../../charting_library/studies/indicators/registry.js';
import { C, M } from '../../../../constants.js';
import { logger } from '@/observability/logger';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';

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
  const indicators = useChartToolsStore((s) => s.indicators);

  const bar = useMemo(() => {
    if (!data?.length || barIdx < 0 || barIdx >= data.length) return null;
    return data[barIdx];
  }, [data, barIdx]);

  // Previous bar for delta calculation
  const prevBar = useMemo(() => {
    if (!data?.length || barIdx <= 0 || barIdx >= data.length) return null;
    return data[barIdx - 1];
  }, [data, barIdx]);

  // Compute indicator values at hovered bar
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
            result.push({
              label: `${def.shortName || regId}`,
              color: ind.color || out.color || '#AAA',
              value: val,
            });
          }
        }
      } catch (e) { logger.ui.warn('Operation failed', e); }
    }
    return result;
  }, [bar, indicators, data, barIdx]);

  if (!bar) return null;

  const isUp = bar.close >= bar.open;
  const changeColor = isUp ? '#26A69A' : '#EF5350';

  // Price delta from previous bar
  const delta = prevBar ? bar.close - prevBar.close : 0;
  const deltaPct = prevBar?.close ? ((delta / prevBar.close) * 100) : 0;
  const isDeltaUp = delta >= 0;

  const pillBg = 'rgba(14, 16, 22, 0.88)';
  const pillBorder = 'rgba(255,255,255,0.06)';

  return (
    <>
      {/* ─── Horizontal Crosshair Label (right edge) ─── */}
      <div
        className="tf-fade-in"
        style={{
          position: 'absolute',
          top: Math.max(4, Math.min((mouseY || 100) - 14, 600)),
          right: 4,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          background: pillBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${pillBorder}`,
          borderRadius: 8,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        {/* Current price */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: M,
            fontVariantNumeric: 'tabular-nums',
            color: changeColor,
          }}
        >
          {fmt(bar.close)}
        </span>

        {/* Delta */}
        {prevBar && (
          <>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: M,
                fontVariantNumeric: 'tabular-nums',
                color: isDeltaUp ? '#26A69A' : '#EF5350',
              }}
            >
              {isDeltaUp ? '+' : ''}{fmt(delta)}
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 500,
                fontFamily: M,
                color: isDeltaUp ? '#26A69A' : '#EF5350',
                opacity: 0.7,
              }}
            >
              {isDeltaUp ? '+' : ''}{deltaPct.toFixed(2)}%
            </span>
          </>
        )}
      </div>

      {/* ─── Indicator Values (inline dots) ─── */}
      {/* Item 38: OHLCV row removed — UnifiedStatusBar is the canonical source */}
      {indicatorValues.length > 0 && (
        <div
          className="tf-fade-in"
          style={{
            position: 'absolute',
            top: 28,
            left: 8,
            zIndex: 55,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 6px',
            background: pillBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${pillBorder}`,
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        >
          {indicatorValues.map((iv, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: iv.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, color: C.t3, fontWeight: 600 }}>{iv.label}</span>
              <span style={{ fontSize: 9, color: iv.color, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontFamily: M }}>
                {fmt(iv.value)}
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
