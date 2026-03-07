// ═══════════════════════════════════════════════════════════════════
// charEdge — Crosshair HUD Overlay (F1.1)
//
// Floating OHLCV + indicator value display that follows cursor at
// 16px offset. Auto-repositions to avoid screen edges.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, M } from '../../../../../../constants.js';

/**
 * @typedef {Object} CrosshairData
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 * @property {Record<string, number>} indicators - indicator key → value
 * @property {number} timestamp
 */

const HUD_OFFSET = 16;
const EDGE_MARGIN = 12;
const HUD_WIDTH = 180;
const HUD_HEIGHT = 200;

/**
 * CrosshairHUD — floating OHLCV + indicator overlay.
 *
 * Subscribes to CrosshairBus for position updates and renders
 * data for the hovered candle with glass-depth styling.
 */
export default function CrosshairHUD({ crosshairBus, chartRef, visible = true }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [data, setData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const hudRef = useRef(null);

  const handleCrosshairMove = useCallback(({ x, y, barData }) => {
    if (!barData || !visible) {
      setIsVisible(false);
      return;
    }

    // Compute flipped position to avoid edges
    const chart = chartRef?.current;
    const cw = chart?.offsetWidth || window.innerWidth;
    const ch = chart?.offsetHeight || window.innerHeight;

    let hudX = x + HUD_OFFSET;
    let hudY = y + HUD_OFFSET;

    // Flip horizontally if near right edge
    if (hudX + HUD_WIDTH + EDGE_MARGIN > cw) {
      hudX = x - HUD_WIDTH - HUD_OFFSET;
    }
    // Flip vertically if near bottom edge
    if (hudY + HUD_HEIGHT + EDGE_MARGIN > ch) {
      hudY = y - HUD_HEIGHT - HUD_OFFSET;
    }

    // Clamp to viewport
    hudX = Math.max(EDGE_MARGIN, hudX);
    hudY = Math.max(EDGE_MARGIN, hudY);

    setPosition({ x: hudX, y: hudY });
    setData(barData);
    setIsVisible(true);
  }, [visible, chartRef]);

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

  const formatPrice = (v) => typeof v === 'number' ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
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
      className="tf-depth-floating"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: HUD_WIDTH,
        padding: '10px 12px',
        borderRadius: 'var(--tf-radius-md)',
        border: 'var(--tf-glass-border)',
        pointerEvents: 'none',
        zIndex: 50,
        fontFamily: 'var(--tf-mono)',
        fontSize: 11,
        lineHeight: 1.6,
        color: 'var(--tf-t1)',
        transition: 'opacity 0.1s ease, transform 0.1s ease',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {/* OHLCV Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: '1px 6px' }}>
        <span style={{ color: 'var(--tf-t3)', fontWeight: 600 }}>O</span>
        <span>{formatPrice(data.open)}</span>
        <span style={{ color: 'var(--tf-t3)', fontWeight: 600 }}>H</span>
        <span style={{ color: 'var(--tf-green)' }}>{formatPrice(data.high)}</span>
        <span style={{ color: 'var(--tf-t3)', fontWeight: 600 }}>L</span>
        <span style={{ color: 'var(--tf-red)' }}>{formatPrice(data.low)}</span>
        <span style={{ color: 'var(--tf-t3)', fontWeight: 600 }}>C</span>
        <span style={{ color: changeColor, fontWeight: 600 }}>{formatPrice(data.close)}</span>
        <span style={{ color: 'var(--tf-t3)', fontWeight: 600 }}>V</span>
        <span>{formatVol(data.volume)}</span>
      </div>

      {/* Change line */}
      <div style={{
        marginTop: 4,
        paddingTop: 4,
        borderTop: '1px solid var(--tf-bd)',
        color: changeColor,
        fontWeight: 600,
        fontSize: 10,
      }}>
        {isUp ? '▲' : '▼'} {change >= 0 ? '+' : ''}{formatPrice(change)} ({changePct}%)
      </div>

      {/* Indicator values */}
      {data.indicators && Object.keys(data.indicators).length > 0 && (
        <div style={{
          marginTop: 4,
          paddingTop: 4,
          borderTop: '1px solid var(--tf-bd)',
          fontSize: 10,
          color: 'var(--tf-t2)',
        }}>
          {Object.entries(data.indicators).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: 'var(--tf-t3)', textTransform: 'uppercase' }}>{key}</span>
              <span style={{ fontWeight: 500 }}>{typeof val === 'number' ? val.toFixed(2) : val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
