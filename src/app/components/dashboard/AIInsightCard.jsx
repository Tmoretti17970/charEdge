// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Insight Card (Sprint 2)
//
// Displays the top AI-generated trading insights as an interactive
// carousel card on the dashboard. Cycles through insights with
// dot indicators, swipe on mobile, and auto-rotate every 10s.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { radii } from '../../../theme/tokens.js';
import AIOrb from '../design/AIOrb.jsx';
import { generateInsights } from './hooks/useAIInsights.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

const COLOR_MAP = {
  green: { bg: (c) => `${c.g}0A`, border: (c) => `${c.g}25`, accent: (c) => c.g, iconBg: (c) => `${c.g}15` },
  red: { bg: (c) => `${c.r}0A`, border: (c) => `${c.r}25`, accent: (c) => c.r, iconBg: (c) => `${c.r}15` },
  yellow: { bg: (c) => `${c.y}0A`, border: (c) => `${c.y}25`, accent: (c) => c.y, iconBg: (c) => `${c.y}15` },
  blue: { bg: (c) => `${c.b}0A`, border: (c) => `${c.b}25`, accent: (c) => c.b, iconBg: (c) => `${c.b}15` },
};

const TYPE_LABELS = {
  pattern: 'INSIGHT',
  warning: 'HEADS UP',
  streak: 'STREAK',
};

export default function AIInsightCard() {
  const trades = useJournalStore((s) => s.trades);
  const settings = useUserStore.getState();
  const { isMobile } = useBreakpoints();
  const [activeIdx, setActiveIdx] = useState(0);
  const [dismissed, setDismissed] = useState(new Set());

  // Generate insights (memoized, recalculates when trades change)
  const allInsights = useMemo(() => {
    return generateInsights(trades, settings);
  }, [trades, settings]);

  // Filter out dismissed insights
  const insights = useMemo(() => {
    return allInsights.filter((i) => !dismissed.has(i.id));
  }, [allInsights, dismissed]);

  // Clamp active index
  useEffect(() => {
    if (activeIdx >= insights.length) setActiveIdx(Math.max(0, insights.length - 1));
  }, [insights.length, activeIdx]);

  // Auto-rotate every 10s
  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % insights.length);
    }, 10_000);
    return () => clearInterval(timer);
  }, [insights.length]);

  const handleDismiss = useCallback((id) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const handlePrev = useCallback(() => {
    setActiveIdx((prev) => (prev - 1 + insights.length) % insights.length);
  }, [insights.length]);

  const handleNext = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % insights.length);
  }, [insights.length]);

  // Don't render if no insights
  if (insights.length === 0) return null;

  const insight = insights[activeIdx];
  if (!insight) return null;

  const colors = COLOR_MAP[insight.color] || COLOR_MAP.blue;
  const typeLabel = TYPE_LABELS[insight.type] || 'INSIGHT';

  return (
    <div
      className="tf-container tf-ai-insight-card"
      style={{
        padding: '4px 12px',
        borderRadius: radii.md,
        background: colors.bg(C),
        border: `1px solid ${colors.border(C)}`,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Single row: badge + icon + content + dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* AI badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '1px 6px',
            borderRadius: radii.pill,
            background: colors.iconBg(C),
            border: `1px solid ${colors.accent(C)}30`,
            flexShrink: 0,
          }}
        >
          <AIOrb size={10} />
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              fontFamily: M,
              color: colors.accent(C),
              letterSpacing: '0.05em',
            }}
          >
            AI {typeLabel}
          </span>
        </div>

        {insights.length > 1 && (
          <span style={{ fontSize: 8, color: C.t3, fontFamily: M, flexShrink: 0 }}>
            {activeIdx + 1}/{insights.length}
          </span>
        )}

        {/* Icon */}
        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{insight.icon}</span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
              color: C.t1,
              fontFamily: F,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {insight.title}
          </span>
          {!isMobile && (
            <span style={{ fontSize: 11, color: C.t2, fontFamily: M, marginLeft: 6, lineHeight: 1.4 }}>
              {insight.body}
            </span>
          )}
        </div>

        {/* Carousel dots inline */}
        {insights.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <NavArrow direction="left" onClick={handlePrev} />
              {insights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    width: i === activeIdx ? 28 : 16,
                    height: 16,
                    minWidth: 0,
                    minHeight: 0,
                    borderRadius: radii.pill,
                    border: 'none',
                    background: i === activeIdx ? colors.accent(C) : C.t3 + '40',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
              <NavArrow direction="right" onClick={handleNext} />
            </div>
            <span style={{ fontSize: 7, color: C.t3, fontFamily: F, opacity: 0.5 }}>
              Not financial advice
            </span>
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={() => handleDismiss(insight.id)}
          className="tf-btn tf-hover-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            fontSize: 12,
            cursor: 'pointer',
            padding: '0 2px',
            borderRadius: radii.xs,
            lineHeight: 1,
            flexShrink: 0,
          }}
          title="Dismiss this insight"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function NavArrow({ direction, onClick }) {
  return (
    <button
      className="tf-btn tf-hover-opacity"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: C.t3,
        fontSize: 10,
        cursor: 'pointer',
        padding: '0 4px',
      }}
    >
      {direction === 'left' ? '◀' : '▶'}
    </button>
  );
}
