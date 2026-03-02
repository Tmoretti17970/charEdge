// ═══════════════════════════════════════════════════════════════════
// charEdge — Pre-Market Checklist Card (Sprint 6)
//
// Dashboard card showing a collapsible daily pre-market checklist.
// Uses the existing useChecklistStore for items + check state.
// Awards XP on full completion and tracks streaks.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useCallback } from 'react';
import { C, M, F } from '../../../constants.js';
import { useChecklistStore } from '../../../state/useChecklistStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';

// ─── Pre-market items (daily ritual, separate from per-trade checklist) ──

const PRE_MARKET_ITEMS = [
  { id: 'pm_levels', label: 'Reviewed key support/resistance levels', emoji: '📊' },
  { id: 'pm_calendar', label: 'Checked economic calendar & news', emoji: '📰' },
  { id: 'pm_plan', label: 'Set daily trade plan', emoji: '📋' },
  { id: 'pm_risk', label: 'Defined daily risk budget', emoji: '🛡️' },
  { id: 'pm_target', label: 'Set session P&L target', emoji: '🎯' },
  { id: 'pm_rules', label: 'Reviewed trading rules', emoji: '📕' },
  { id: 'pm_mindset', label: 'Mental check-in: focused & calm', emoji: '🧘' },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function PreMarketChecklist() {
  const { isMobile } = useBreakpoints();
  const awardXP = useGamificationStore((s) => s.awardXP);

  // Local daily state (separate from per-trade checklist)
  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem('tf-premarket-' + getTodayKey());
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // Sprint 1: Auto-collapse on same-day revisits or if already completed
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const todayKey = getTodayKey();
      const saved = localStorage.getItem('tf-premarket-' + todayKey);
      const visited = localStorage.getItem('tf-premarket-visited-' + todayKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const allChecked = PRE_MARKET_ITEMS.every((i) => parsed[i.id]);
        if (allChecked) return true; // Always collapse if completed
      }
      // Collapse on revisit (not first visit today)
      if (visited) return true;
      // Mark first visit
      try { localStorage.setItem('tf-premarket-visited-' + todayKey, '1'); } catch {}
      return false;
    } catch {}
    return false;
  });
  const [xpAwarded, setXpAwarded] = useState(() => {
    try {
      return localStorage.getItem('tf-premarket-xp-' + getTodayKey()) === 'true';
    } catch { return false; }
  });

  const completedCount = useMemo(() =>
    PRE_MARKET_ITEMS.filter((i) => checked[i.id]).length, [checked]);
  const allDone = completedCount === PRE_MARKET_ITEMS.length;
  const progress = Math.round((completedCount / PRE_MARKET_ITEMS.length) * 100);

  const toggleItem = useCallback((id) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('tf-premarket-' + getTodayKey(), JSON.stringify(next));
      } catch {}

      // Check if all done → award XP + auto-collapse
      const nowAllDone = PRE_MARKET_ITEMS.every((i) => next[i.id]);
      if (nowAllDone && !xpAwarded) {
        awardXP(20, 'checklist_done');
        setXpAwarded(true);
        try {
          localStorage.setItem('tf-premarket-xp-' + getTodayKey(), 'true');
        } catch {}
        // Sprint 1: Auto-collapse after completion with a brief delay for feedback
        setTimeout(() => setCollapsed(true), 1200);
      }
      return next;
    });
  }, [awardXP, xpAwarded]);

  // Sprint 1: Gentler time-based visibility
  // - Before 4 PM: always show (collapsed if done)
  // - After 4 PM and done: hide entirely
  const hour = new Date().getHours();
  if (hour >= 16 && allDone) return null; // Full hide after market close if done

  return (
    <div
      className="tf-premarket-checklist"
      style={{
        borderRadius: 10,
        background: allDone
          ? `linear-gradient(135deg, ${C.g}08, ${C.b}06)`
          : C.sf,
        border: `1px solid ${allDone ? C.g + '25' : C.bd}`,
        marginBottom: 14,
        overflow: 'hidden',
        transition: 'all 0.25s',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '10px 14px' : '12px 18px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>{allDone ? '✅' : '📝'}</span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: M,
            color: C.t3,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Pre-Market Checklist
          </span>
          {allDone && (
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: 100,
              background: C.g + '15',
              color: C.g,
              fontFamily: M,
            }}>
              COMPLETE +20 XP
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress */}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: M,
            color: allDone ? C.g : C.t3,
          }}>
            {completedCount}/{PRE_MARKET_ITEMS.length}
          </span>

          {/* Progress ring */}
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke={C.bg2} strokeWidth="2" />
            <circle
              cx="10" cy="10" r="8" fill="none"
              stroke={allDone ? C.g : C.b}
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 8}`}
              strokeDashoffset={`${2 * Math.PI * 8 * (1 - progress / 100)}`}
              transform="rotate(-90 10 10)"
              style={{ transition: 'stroke-dashoffset 0.3s' }}
            />
          </svg>

          {/* Collapse arrow */}
          <span style={{
            fontSize: 10,
            color: C.t3,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div style={{
          padding: isMobile ? '0 14px 12px' : '0 18px 14px',
        }}>
          {PRE_MARKET_ITEMS.map((item) => {
            const done = checked[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${C.bd}30`,
                  opacity: done ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${done ? C.g : C.t3 + '40'}`,
                  background: done ? C.g + '15' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                  {done && (
                    <span style={{ fontSize: 10, color: C.g, fontWeight: 800 }}>✓</span>
                  )}
                </div>

                {/* Emoji */}
                <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
                  {item.emoji}
                </span>

                {/* Label */}
                <span style={{
                  fontSize: 11,
                  fontFamily: M,
                  color: done ? C.t3 : C.t1,
                  textDecoration: done ? 'line-through' : 'none',
                  transition: 'color 0.15s',
                }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
