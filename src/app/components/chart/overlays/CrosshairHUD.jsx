// ═══════════════════════════════════════════════════════════════════
// charEdge — Crosshair HUD Overlay (F1.1)
//
// Floating OHLCV + indicator value display that follows cursor at
// 16px offset. Auto-repositions to avoid screen edges.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import s from './CrosshairHUD.module.css';

const HUD_OFFSET = 16;
const EDGE_MARGIN = 12;
const HUD_MAX = 220;
const HUD_HEIGHT = 200;

function CrosshairHUD({ crosshairBus, chartRef, visible = true }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [data, setData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const hudRef = useRef(null);
  const prevCloseRef = useRef(null);
  const [flashChange, setFlashChange] = useState(false);

  const handleCrosshairMove = useCallback(
    ({ x, y, barData }) => {
      if (!barData || !visible) {
        setIsVisible(false);
        return;
      }

      const chart = chartRef?.current;
      const cw = chart?.offsetWidth || window.innerWidth;
      const ch = chart?.offsetHeight || window.innerHeight;

      let hudX = x + HUD_OFFSET;
      let hudY = y + HUD_OFFSET;

      if (hudX + HUD_MAX + EDGE_MARGIN > cw) {
        hudX = x - HUD_MAX - HUD_OFFSET;
      }
      if (hudY + HUD_HEIGHT + EDGE_MARGIN > ch) {
        hudY = y - HUD_HEIGHT - HUD_OFFSET;
      }

      hudX = Math.max(EDGE_MARGIN, hudX);
      hudY = Math.max(EDGE_MARGIN, hudY);

      setPosition({ x: hudX, y: hudY });
      setData(barData);
      setIsVisible(true);

      if (prevCloseRef.current !== null && barData.close !== prevCloseRef.current) {
        setFlashChange(true);
        setTimeout(() => setFlashChange(false), 200);
      }
      prevCloseRef.current = barData.close;
    },
    [visible, chartRef],
  );

  const handleCrosshairLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!crosshairBus) return;
    crosshairBus.on('move', handleCrosshairMove);
    crosshairBus.on('leave', handleCrosshairLeave);
    return () => {
      crosshairBus.off('move', handleCrosshairMove);
      crosshairBus.off('leave', handleCrosshairLeave);
    };
  }, [crosshairBus, handleCrosshairMove, handleCrosshairLeave]);

  if (!isVisible || !data) return null;

  const change = data.close - data.open;
  const changePct = data.open ? ((change / data.open) * 100).toFixed(2) : '0.00';
  const isUp = change >= 0;
  const changeColor = isUp ? 'var(--tf-green)' : 'var(--tf-red)';

  const formatPrice = (v) =>
    typeof v === 'number' ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
  const formatVol = (v) => {
    if (!v) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  };

  return (
    <div
      ref={hudRef}
      className={`${s.hud} tf-depth-floating`}
      style={{ left: position.x, top: position.y }}
      data-visible={isVisible}
    >
      {/* OHLCV Grid */}
      <div className={s.ohlcvGrid}>
        <span className={s.ohlcvLabel}>O</span>
        <span>{formatPrice(data.open)}</span>
        <span className={s.ohlcvLabel}>H</span>
        <span className={s.ohlcvHigh}>{formatPrice(data.high)}</span>
        <span className={s.ohlcvLabel}>L</span>
        <span className={s.ohlcvLow}>{formatPrice(data.low)}</span>
        <span className={s.ohlcvLabel}>C</span>
        <span className={s.ohlcvClose} style={{ color: changeColor }}>
          {formatPrice(data.close)}
        </span>
        <span className={s.ohlcvLabel}>V</span>
        <span>{formatVol(data.volume)}</span>
      </div>

      {/* Change line */}
      <div className={s.changeLine} style={{ color: changeColor, opacity: flashChange ? 0.5 : 1 }}>
        {isUp ? '▲' : '▼'} {change >= 0 ? '+' : ''}
        {formatPrice(change)} ({changePct}%)
      </div>

      {/* Indicator values */}
      {data.indicators && Object.keys(data.indicators).length > 0 && (
        <div className={s.indicators}>
          {Object.entries(data.indicators).map(([key, val]) => (
            <div key={key} className={s.indicatorRow}>
              <span className={s.indicatorKey}>{key}</span>
              <span className={s.indicatorVal}>{typeof val === 'number' ? val.toFixed(2) : val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(CrosshairHUD);
