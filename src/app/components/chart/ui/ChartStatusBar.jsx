// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Status Bar (Apple × TradingView Polish)
// Slim bottom bar: OHLCV · change% · countdown · scale mode
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { C, F, M, getAssetClass } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';
import { formatPrice } from '../../../../charting_library/core/CoordinateSystem.js';
import { tfToMs, formatCountdown } from '../../../../charting_library/core/barCountdown.js';
import { getMarketStatus } from '../../../../utils/marketHours.js';

const SCALE_MODES = [
  { id: 'auto', label: 'Auto', icon: 'A' },
  { id: 'log', label: 'Log', icon: 'L' },
  { id: 'pct', label: '%', icon: '%' },
  { id: 'inverted', label: 'Inv', icon: '⇅' },
];

function formatVolume(vol) {
  if (!vol || !isFinite(vol)) return '—';
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toFixed(0);
}

export default function ChartStatusBar({ hoveredBar }) {
  const data = useChartStore((s) => s.data);
  const tf = useChartStore((s) => s.tf);
  const symbol = useChartStore((s) => s.symbol);
  const scaleMode = useChartStore((s) => s.scaleMode);
  const setScaleMode = useChartStore((s) => s.setScaleMode);
  const [countdown, setCountdown] = useState('');
  const [scaleOpen, setScaleOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState(null);
  const [dataAge, setDataAge] = useState(null);
  const scaleRef = useRef(null);

  // Determine which bar to display: hovered or latest
  const displayBar = useMemo(() => {
    if (hoveredBar) return hoveredBar;
    if (data?.length) return data[data.length - 1];
    return null;
  }, [hoveredBar, data]);

  // Previous bar for change calculation
  const prevBar = useMemo(() => {
    if (!data?.length) return null;
    if (hoveredBar) {
      const idx = data.indexOf(hoveredBar);
      return idx > 0 ? data[idx - 1] : null;
    }
    return data.length > 1 ? data[data.length - 2] : null;
  }, [hoveredBar, data]);

  // Change calculation
  const change = useMemo(() => {
    if (!displayBar || !prevBar) return null;
    const diff = displayBar.close - prevBar.close;
    const pct = prevBar.close !== 0 ? (diff / prevBar.close) * 100 : 0;
    return { diff, pct, isUp: diff >= 0 };
  }, [displayBar, prevBar]);

  // Bar countdown timer
  useEffect(() => {
    const tfMs = tfToMs(tf);
    if (!tfMs || !data?.length) {
      setCountdown('');
      return;
    }

    const tick = () => {
      const lastBar = data[data.length - 1];
      if (!lastBar?.time) {
        setCountdown('');
        return;
      }
      const nextBarTime = lastBar.time + tfMs;
      const remaining = nextBarTime - Date.now();
      setCountdown(remaining > 0 ? formatCountdown(remaining) : '00:00');
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tf, data]);

  // Click outside to close scale picker
  useEffect(() => {
    const handler = (e) => {
      if (scaleRef.current && !scaleRef.current.contains(e.target)) setScaleOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Market status + data staleness — updates every 30s
  useEffect(() => {
    const update = () => {
      const ac = getAssetClass(symbol);
      setMarketStatus(getMarketStatus(symbol));

      // Data staleness: check age of last bar
      if (data?.length) {
        const lastBarTime = data[data.length - 1]?.time;
        if (lastBarTime) {
          const age = Date.now() - lastBarTime;
          setDataAge(age);
        } else {
          setDataAge(null);
        }
      } else {
        setDataAge(null);
      }
    };

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [symbol, data]);

  if (!displayBar) return null;

  const currentScaleMode = SCALE_MODES.find((m) => m.id === scaleMode) || SCALE_MODES[0];

  // Is countdown urgent (< 10 seconds)?
  const isUrgent = countdown && !countdown.includes('m') && !countdown.includes('h') &&
    parseInt(countdown) <= 10 && parseInt(countdown) > 0;

  // Determine bar direction for coloring
  const barIsUp = displayBar.close >= displayBar.open;
  const dirColor = barIsUp ? C.g : C.r;

  return (
    <div className="tf-chart-status-bar">
      {/* OHLCV with direction-aware coloring */}
      <span className="tf-status-group">
        <span className="tf-status-label">O</span>
        <span className="tf-status-value" style={{ color: displayBar.open >= (prevBar?.close || 0) ? C.g : C.r }}>
          {formatPrice(displayBar.open)}
        </span>
      </span>
      <span className="tf-status-dot" />
      <span className="tf-status-group">
        <span className="tf-status-label">H</span>
        <span className="tf-status-value" style={{ color: C.g }}>
          {formatPrice(displayBar.high)}
        </span>
      </span>
      <span className="tf-status-dot" />
      <span className="tf-status-group">
        <span className="tf-status-label">L</span>
        <span className="tf-status-value" style={{ color: C.r }}>
          {formatPrice(displayBar.low)}
        </span>
      </span>
      <span className="tf-status-dot" />
      <span className="tf-status-group tf-status-close">
        <span className="tf-status-label">C</span>
        <span className="tf-status-value" style={{ color: dirColor, fontWeight: 700, fontSize: 12 }}>
          {formatPrice(displayBar.close)}
        </span>
      </span>

      {/* Change */}
      {change && (
        <span className="tf-status-change" data-direction={change.isUp ? 'up' : 'down'}>
          <span className="tf-status-change-arrow">{change.isUp ? '▲' : '▼'}</span>
          {change.isUp ? '+' : ''}
          {formatPrice(change.diff)} ({change.pct >= 0 ? '+' : ''}
          {change.pct.toFixed(2)}%)
        </span>
      )}

      <span className="tf-status-dot" />

      {/* Volume */}
      <span className="tf-status-group">
        <span className="tf-status-label">Vol</span>
        <span className="tf-status-value">{formatVolume(displayBar.volume)}</span>
      </span>

      {/* Market Status Badge */}
      {marketStatus && (
        <span
          className="tf-status-group"
          title={`${marketStatus} — ${getAssetClass(symbol)}`}
          style={{ gap: 3 }}
        >
          <span style={{ fontSize: 8 }}>
            {marketStatus === '24/7' ? '🟢' :
             marketStatus === 'Market Open' ? '🟢' :
             marketStatus === 'Extended Hours' ? '🟡' : '🔴'}
          </span>
          <span className="tf-status-value" style={{
            color: marketStatus === 'Market Closed' ? C.t3 :
                   marketStatus === 'Extended Hours' ? C.y : C.g,
            fontSize: 9,
          }}>
            {marketStatus === '24/7' ? '24/7' :
             marketStatus === 'Market Open' ? 'Open' :
             marketStatus === 'Extended Hours' ? 'Ext' : 'Closed'}
          </span>
        </span>
      )}

      {/* Data Staleness Indicator */}
      {dataAge != null && dataAge > 5 * 60_000 && (
        <span
          className="tf-status-group"
          title={`Last data update: ${Math.round(dataAge / 60_000)}m ago`}
          style={{ gap: 3 }}
        >
          <span style={{ fontSize: 8 }}>⚠️</span>
          <span className="tf-status-value" style={{ color: C.y, fontSize: 9 }}>
            {Math.round(dataAge / 60_000)}m
          </span>
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bar Countdown */}
      {countdown && (
        <span
          className={isUrgent ? 'tf-countdown-urgent' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Time until next bar close"
        >
          <span style={{ fontSize: 10 }}>⏱</span>
          <span className="tf-status-value">{countdown}</span>
        </span>
      )}

      {/* Scale Mode Picker */}
      <div ref={scaleRef} style={{ position: 'relative' }}>
        <button
          className="tf-chart-toolbar-btn"
          data-active={scaleOpen || undefined}
          onClick={() => setScaleOpen(!scaleOpen)}
          style={{
            fontFamily: M,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            gap: 3,
          }}
          title="Scale Mode"
        >
          {currentScaleMode.icon} {currentScaleMode.label}
          <span style={{ fontSize: 7, marginLeft: 1 }}>▼</span>
        </button>

        {scaleOpen && (
          <div
            className="tf-chart-dropdown"
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 6,
              minWidth: 120,
              transformOrigin: 'bottom right',
            }}
          >
            {SCALE_MODES.map((mode) => {
              const isActive = scaleMode === mode.id;
              return (
                <button
                  key={mode.id}
                  className="tf-chart-dropdown-item"
                  data-active={isActive || undefined}
                  onClick={() => {
                    setScaleMode(mode.id);
                    setScaleOpen(false);
                  }}
                >
                  <span style={{ width: 18, textAlign: 'center', fontWeight: 700, flexShrink: 0 }}>{mode.icon}</span>
                  {mode.label}
                  {isActive && (
                    <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
