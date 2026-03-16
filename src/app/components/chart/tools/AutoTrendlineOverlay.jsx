// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto Trendline Overlay  (Sprint 12)
// Renders AI-detected trendlines as ghost lines with accept/dismiss.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { detectTrendlines } from '../../../../charting_library/tools/intelligence/autoTrendlines';
import useChartToolsStore from '../../../../state/chart/useChartToolsStore';

/**
 * @param {Object} props
 * @param {Array} props.bars - OHLC bar data (oldest first)
 * @param {Function} props.priceToY - Convert price to CSS Y coordinate
 * @param {Function} props.idxToX - Convert bar index to CSS X coordinate
 * @param {number} props.chartWidth - Chart width in CSS pixels
 * @param {Function} props.onAccept - Called with drawing data when user accepts
 */
export default function AutoTrendlineOverlay({ bars, priceToY, idxToX, chartWidth, onAccept }) {
  const { autoTrendlinesEnabled, dismissedTrendlines, dismissTrendline } = useChartToolsStore();
  const [hoveredId, setHoveredId] = useState(null);

  const sensitivityConfig = useMemo(() => ({
    tight: { swingWindow: 3, maxLines: 2, minSwingDist: 8 },
    standard: { swingWindow: 5, maxLines: 3, minSwingDist: 10 },
    loose: { swingWindow: 8, maxLines: 5, minSwingDist: 15 },
  }), []);

  const { autoSRSensitivity } = useChartToolsStore();

  const trendlines = useMemo(() => {
    if (!autoTrendlinesEnabled || !bars || bars.length < 30) return [];
    const config = sensitivityConfig[autoSRSensitivity] || sensitivityConfig.standard;
    return detectTrendlines(bars, config);
  }, [bars, autoTrendlinesEnabled, autoSRSensitivity, sensitivityConfig]);

  const visibleLines = useMemo(() => {
    return trendlines.filter(l => !dismissedTrendlines.has(l.id));
  }, [trendlines, dismissedTrendlines]);

  const handleAccept = useCallback((line) => {
    if (onAccept) {
      onAccept({
        type: 'trendline',
        points: [
          { price: line.startPoint.price, time: line.startPoint.time },
          { price: line.endPoint.price, time: line.endPoint.time },
        ],
        style: {
          color: line.direction === 'up' ? '#26A69A' : '#EF5350',
          lineWidth: 2,
          dash: [],
        },
        meta: { autoDetected: true, direction: line.direction, touches: line.touches },
      });
    }
    dismissTrendline(line.id);
  }, [onAccept, dismissTrendline]);

  const handleDismiss = useCallback((line) => {
    dismissTrendline(line.id);
  }, [dismissTrendline]);

  if (!autoTrendlinesEnabled || visibleLines.length === 0 || !priceToY || !idxToX) return null;

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 5,
      }}
    >
      {visibleLines.map((line) => {
        const x1 = idxToX(line.startPoint.idx);
        const y1 = priceToY(line.startPoint.price);
        const x2 = idxToX(line.endPoint.idx);
        const y2 = priceToY(line.endPoint.price);

        if (x1 == null || y1 == null || x2 == null || y2 == null) return null;

        const lineColor = line.direction === 'up' ? '#26A69A' : '#EF5350';
        const isHovered = hoveredId === line.id;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return (
          <g key={line.id}>
            {/* Ghost trendline */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={lineColor}
              strokeWidth={isHovered ? 2.5 : 1.5}
              strokeOpacity={isHovered ? 0.6 : 0.25}
              strokeDasharray="6 4"
              style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s' }}
            />

            {/* Extended projection (dashed, fainter) */}
            <line
              x1={x2} y1={y2}
              x2={x2 + (x2 - x1) * 0.5}
              y2={y2 + (y2 - y1) * 0.5}
              stroke={lineColor}
              strokeWidth={1}
              strokeOpacity={isHovered ? 0.2 : 0.1}
              strokeDasharray="4 6"
            />

            {/* Hover target (invisible, wide) */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="transparent" strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(line.id)}
              onMouseLeave={() => setHoveredId(null)}
            />

            {/* Label */}
            {isHovered && (
              <foreignObject x={midX - 70} y={midY - 18} width={140} height={28} style={{ pointerEvents: 'auto' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '3px 6px', borderRadius: 6,
                  background: 'rgba(20,22,30,0.95)',
                  border: `1px solid ${lineColor}30`,
                  backdropFilter: 'blur(8px)',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}>
                  <span style={{ fontSize: 7, fontWeight: 800, color: lineColor, background: `${lineColor}18`, padding: '1px 3px', borderRadius: 3 }}>AI</span>
                  <span style={{ fontSize: 10, color: '#D1D4DC', fontWeight: 500 }}>
                    {line.direction === 'up' ? '↗ Support' : '↘ Resistance'}
                  </span>
                  <span style={{ fontSize: 8, color: '#787B86' }}>{line.touches}×</span>
                  <button
                    onClick={() => handleAccept(line)}
                    style={{ background: `${lineColor}15`, border: `1px solid ${lineColor}30`, color: lineColor, fontSize: 10, cursor: 'pointer', borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}
                  >✓</button>
                  <button
                    onClick={() => handleDismiss(line)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#787B86', fontSize: 10, cursor: 'pointer', borderRadius: 4, padding: '1px 4px' }}
                  >✕</button>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
}
