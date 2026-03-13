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
        padding: isMobile ? '14px 16px' : '16px 20px',
        borderRadius: radii.md,
        background: colors.bg(C),
        border: `1px solid ${colors.border(C)}`,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* AI badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: radii.pill,
              background: colors.iconBg(C),
              border: `1px solid ${colors.accent(C)}30`,
            }}
          >
            <AIOrb size={12} />
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                fontFamily: M,
                color: colors.accent(C),
                letterSpacing: '0.05em',
              }}
            >
              AI {typeLabel}
            </span>
          </div>

          {/* Counter */}
          {insights.length > 1 && (
            <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
              {activeIdx + 1}/{insights.length}
            </span>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => handleDismiss(insight.id)}
          className="tf-btn tf-hover-opacity"
          style={{
            background: 'none',
            border: 'none',
            color: C.t3,
            fontSize: 14,
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: radii.xs,
            lineHeight: 1,
          }}
          title="Dismiss this insight"
        >
          ×
        </button>
      </div>

      {/* Insight content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div
          style={{
            fontSize: 24,
            lineHeight: 1,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {insight.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.t1,
              fontFamily: F,
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {insight.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.t2,
              fontFamily: M,
              lineHeight: 1.5,
            }}
          >
            {insight.body}
          </div>
        </div>
      </div>

      {/* Financial disclaimer */}
      <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginTop: 10, opacity: 0.7 }}>
        ⚖️ For educational purposes only — not financial advice.
      </div>

      {/* Dot indicators + navigation */}
      {insights.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            marginTop: 12,
          }}
        >
          <NavArrow direction="left" onClick={handlePrev} />
          {insights.map((_, i) => (
            <button
              key={i}
              className="tf-btn"
              onClick={() => setActiveIdx(i)}
              style={{
                width: i === activeIdx ? 16 : 6,
                height: 6,
                borderRadius: radii.xs,
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
      )}
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
