// ═══════════════════════════════════════════════════════════════════
// charEdge — Predictive Velocity HUD (4.7.6)
//
// Real-time $/sec price velocity display computed from tick stream.
// Rolling 5s/30s/5m windows with acceleration indicator.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import s from './VelocityHUD.module.css';

const WINDOWS = [
  { label: '5s', ms: 5_000 },
  { label: '30s', ms: 30_000 },
  { label: '5m', ms: 300_000 },
];

function getAccelerationColor(velocity, prevVelocity) {
  if (velocity === 0) return 'var(--tf-t3)';
  const accel = velocity - (prevVelocity || 0);
  if (Math.abs(accel) < 0.01) return 'var(--tf-t2)';
  return accel > 0 ? 'var(--tf-green)' : 'var(--tf-red)';
}

function formatVelocity(v) {
  if (v === 0 || isNaN(v)) return '$0.00/s';
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K/s`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}/s`;
  return `${sign}$${abs.toFixed(4)}/s`;
}

function VelocityHUD({ ticks = [], visible = true }) {
  const [velocities, setVelocities] = useState({});
  const prevVelocityRef = useRef(0);
  const [dimmed, setDimmed] = useState(false);
  const fadeTimerRef = useRef(null);

  const computeVelocities = useCallback(() => {
    if (!ticks.length) return;
    const now = ticks[ticks.length - 1]?.timestamp || Date.now();
    const result = {};
    for (const window of WINDOWS) {
      const cutoff = now - window.ms;
      const windowTicks = ticks.filter((t) => t.timestamp >= cutoff);
      if (windowTicks.length < 2) { result[window.label] = 0; continue; }
      const first = windowTicks[0]; const last = windowTicks[windowTicks.length - 1];
      const dt = (last.timestamp - first.timestamp) / 1000;
      const dp = last.price - first.price;
      result[window.label] = dt > 0 ? dp / dt : 0;
    }
    setVelocities(result);
    setDimmed(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setDimmed(true), 10_000);
  }, [ticks]);

  useEffect(() => {
    computeVelocities();
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, [computeVelocities]);

  if (!visible || !Object.keys(velocities).length) return null;

  const primaryVelocity = velocities['5s'] || 0;
  const accelColor = getAccelerationColor(primaryVelocity, prevVelocityRef.current);
  prevVelocityRef.current = primaryVelocity;

  return (
    <div className={`tf-depth-surface ${s.hud}`} data-dimmed={dimmed || undefined}
      onMouseEnter={() => setDimmed(false)}
      onMouseLeave={() => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); fadeTimerRef.current = setTimeout(() => setDimmed(true), 10_000); }}>
      <div className={s.title}>Velocity</div>
      {WINDOWS.map(({ label }) => {
        const v = velocities[label] || 0;
        const color = v > 0 ? 'var(--tf-green)' : v < 0 ? 'var(--tf-red)' : 'var(--tf-t3)';
        return (
          <div key={label} className={s.row}>
            <span className={s.rowLabel}>{label}</span>
            <span className={s.rowValue} style={{ color }}>{formatVelocity(v)}</span>
          </div>
        );
      })}
      <div className={s.accelDot} style={{ background: accelColor, boxShadow: `0 0 6px ${accelColor}` }} />
    </div>
  );
}

export default React.memo(VelocityHUD);
