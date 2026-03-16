// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto S/R Overlay  (Sprint 11)
// Renders AI-detected support/resistance levels as ghost lines
// with accept/dismiss controls.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { detectSRLevels } from '../../../../charting_library/tools/intelligence/autoSR';
import useChartToolsStore from '../../../../state/chart/useChartToolsStore';

/**
 * @param {Object} props
 * @param {Array} props.bars - OHLC bar data (oldest first)
 * @param {Function} props.priceToY - Convert price to CSS Y coordinate
 * @param {number} props.chartWidth - Chart width in CSS pixels
 * @param {Function} props.onAccept - Called with { price, type } when user accepts a level
 */
export default function AutoSROverlay({ bars, priceToY, chartWidth, onAccept }) {
  const { autoSREnabled, autoSRSensitivity, dismissedSRLevels, dismissSRLevel } = useChartToolsStore();
  const [hoveredId, setHoveredId] = useState(null);

  // Sensitivity → config mapping
  const sensitivityConfig = useMemo(() => ({
    tight: { swingWindow: 3, clusterThreshold: 0.003, maxLevels: 3 },
    standard: { swingWindow: 5, clusterThreshold: 0.005, maxLevels: 5 },
    loose: { swingWindow: 8, clusterThreshold: 0.008, maxLevels: 7 },
  }), []);

  // Detect levels (memoized, re-runs when bars change)
  const levels = useMemo(() => {
    if (!autoSREnabled || !bars || bars.length < 20) return [];
    const config = sensitivityConfig[autoSRSensitivity] || sensitivityConfig.standard;
    return detectSRLevels(bars, config);
  }, [bars, autoSREnabled, autoSRSensitivity, sensitivityConfig]);

  // Filter out dismissed levels
  const visibleLevels = useMemo(() => {
    return levels.filter(l => !dismissedSRLevels.has(l.id));
  }, [levels, dismissedSRLevels]);

  const handleAccept = useCallback((level) => {
    if (onAccept) {
      onAccept({
        type: 'hline',
        points: [{ price: level.price, time: 0 }],
        style: {
          color: level.type === 'resistance' ? '#EF5350' : '#26A69A',
          lineWidth: Math.max(1, Math.round(level.strength * 3)),
          dash: [6, 4],
        },
        meta: { autoDetected: true, srType: level.type, touchCount: level.touchCount },
      });
    }
    dismissSRLevel(level.id);
  }, [onAccept, dismissSRLevel]);

  const handleDismiss = useCallback((level) => {
    dismissSRLevel(level.id);
  }, [dismissSRLevel]);

  if (!autoSREnabled || visibleLevels.length === 0 || !priceToY) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {visibleLevels.map((level) => {
        const y = priceToY(level.price);
        if (y == null || y < 0 || y > 2000) return null;
        const isHovered = hoveredId === level.id;
        const lineColor = level.type === 'resistance' ? '#EF5350' : '#26A69A';
        const lineWidth = Math.max(1, Math.round(level.strength * 2.5));

        return (
          <div key={level.id} style={{ position: 'absolute', top: y, left: 0, width: '100%' }}>
            {/* Ghost line */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: lineWidth,
              background: `repeating-linear-gradient(90deg, ${lineColor}40 0, ${lineColor}40 6px, transparent 6px, transparent 12px)`,
              opacity: isHovered ? 0.8 : 0.35,
              transition: 'opacity 0.15s',
            }} />

            {/* Label + actions */}
            <div
              onMouseEnter={() => setHoveredId(level.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'absolute', top: -12, right: 60,
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px',
                borderRadius: 6,
                background: isHovered ? 'rgba(20,22,30,0.95)' : 'rgba(20,22,30,0.7)',
                border: `1px solid ${lineColor}30`,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'all 0.15s',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              }}
            >
              {/* AI badge */}
              <span style={{
                fontSize: 7, fontWeight: 800, color: lineColor,
                background: `${lineColor}18`, padding: '1px 3px', borderRadius: 3,
                letterSpacing: '0.5px',
              }}>AI</span>

              {/* Level info */}
              <span style={{ fontSize: 10, color: '#D1D4DC', fontWeight: 500 }}>
                {level.type === 'resistance' ? 'R' : 'S'} ${level.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>

              {/* Touch count */}
              <span style={{ fontSize: 8, color: '#787B86' }}>
                {level.touchCount}×
              </span>

              {/* Accept button */}
              {isHovered && (
                <>
                  <button
                    onClick={() => handleAccept(level)}
                    style={{
                      background: `${lineColor}15`, border: `1px solid ${lineColor}30`,
                      color: lineColor, fontSize: 10, cursor: 'pointer',
                      borderRadius: 4, padding: '1px 4px', fontWeight: 600,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = `${lineColor}30`}
                    onMouseLeave={(e) => e.currentTarget.style.background = `${lineColor}15`}
                  >✓</button>
                  <button
                    onClick={() => handleDismiss(level)}
                    style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#787B86', fontSize: 10, cursor: 'pointer',
                      borderRadius: 4, padding: '1px 4px',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  >✕</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
