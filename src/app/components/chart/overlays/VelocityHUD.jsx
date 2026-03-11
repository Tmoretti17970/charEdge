// ═══════════════════════════════════════════════════════════════════
// charEdge — Predictive Velocity HUD (4.7.6)
//
// Real-time $/sec price velocity display computed from tick stream.
// Rolling 5s/30s/5m windows with acceleration indicator.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

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

/**
 * VelocityHUD — real-time price velocity display.
 *
 * @param {Object} props
 * @param {Array<{price: number, timestamp: number}>} props.ticks - recent tick data
 * @param {boolean} props.visible - whether to show the HUD
 */
export default function VelocityHUD({ ticks = [], visible = true }) {
  const [velocities, setVelocities] = useState({});
  const prevVelocityRef = useRef(0);
  // P2 2.5: Dimmed auto-fade after 10s of no data change
  const [dimmed, setDimmed] = useState(false);
  const fadeTimerRef = useRef(null);

  const computeVelocities = useCallback(() => {
    if (!ticks.length) return;

    const now = ticks[ticks.length - 1]?.timestamp || Date.now();
    const result = {};

    for (const window of WINDOWS) {
      const cutoff = now - window.ms;
      const windowTicks = ticks.filter((t) => t.timestamp >= cutoff);

      if (windowTicks.length < 2) {
        result[window.label] = 0;
        continue;
      }

      const first = windowTicks[0];
      const last = windowTicks[windowTicks.length - 1];
      const dt = (last.timestamp - first.timestamp) / 1000; // seconds
      const dp = last.price - first.price;

      result[window.label] = dt > 0 ? dp / dt : 0;
    }

    setVelocities(result);
    // P2 2.5: Reset fade on new data
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
    <div
      className="tf-depth-surface"
      onMouseEnter={() => setDimmed(false)}
      onMouseLeave={() => {
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => setDimmed(true), 10_000);
      }}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: '6px 10px',
        borderRadius: 'var(--tf-radius-sm)',
        border: 'var(--tf-glass-border)',
        fontFamily: 'var(--tf-mono)',
        fontSize: 10,
        lineHeight: 1.5,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 100,
        pointerEvents: 'auto',
        opacity: dimmed ? 0.3 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      <div style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--tf-t3)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 2,
      }}>
        Velocity
      </div>
      {WINDOWS.map(({ label }) => {
        const v = velocities[label] || 0;
        const color = v > 0 ? 'var(--tf-green)' : v < 0 ? 'var(--tf-red)' : 'var(--tf-t3)';
        return (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: 'var(--tf-t3)' }}>{label}</span>
            <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatVelocity(v)}
            </span>
          </div>
        );
      })}
      {/* Acceleration dot */}
      <div style={{
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: accelColor,
        alignSelf: 'center',
        marginTop: 2,
        boxShadow: `0 0 6px ${accelColor}`,
      }} />
    </div>
  );
}
