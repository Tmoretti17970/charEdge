// ═══════════════════════════════════════════════════════════════════
// charEdge — Changelog Page
//
// In-app version history with categorized release notes.
// Each version is a collapsible card with tag, date, and items.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { C, F, M } from '../constants.js';

// ─── Changelog Data ─────────────────────────────────────────────
// Prepopulated with v11.0 covering Phases 0–4.
// Future versions go at the top of the array.

export const CHANGELOG_ENTRIES = [
  {
    version: '11.2.0',
    date: '2026-03-11',
    tag: 'minor',
    title: 'Chart UX & Infrastructure',
    items: [
      { type: 'new', text: 'Timezone selector in status bar — live clock with selectable timezone display' },
      { type: 'new', text: 'P&L pill redesign — dropdown menu below pill instead of inline expansion, auto-fit button alongside' },
      { type: 'new', text: 'Drawing tools template bar — quick-access toolbar for chart annotations' },
      { type: 'new', text: 'Dashboard narrative layout — hero stats, narrative sections, per-widget loading' },
      { type: 'new', text: 'WASM indicator engine — compiled and packaged for production builds' },
      { type: 'polish', text: 'Dark mode briefing tiles — replaced washed-out GLASS.subtle with relative tint for proper surface elevation' },
      { type: 'polish', text: 'Indicators default to off — EMA/SMA no longer reappear on page reload' },
      { type: 'polish', text: 'P2P social modules quarantined — cleaner codebase with unused modules moved to _quarantine' },
      { type: 'perf', text: 'API proxy security hardening — rate limiting, CSP headers, encrypted key storage across 7 endpoints' },
      { type: 'fix', text: 'Duplicate Live badge removed — LiveTicker and DataSourceBadge no longer both render' },
      { type: 'fix', text: 'Timeframe switching unstuck — chart no longer locked to 1h interval' },
      { type: 'fix', text: 'Vercel build fixes — WASM imports with vite-ignore, worker format set to ES modules' },
      { type: 'fix', text: 'LLMService import path corrected — src/ai/ instead of src/intelligence/' },
    ],
  },
  {
    version: '11.1.0',
    date: '2026-03-06',
    tag: 'minor',
    title: 'Ship-Ready: P0 Complete',
    items: [
      { type: 'new', text: 'Infinite-canvas minimap — year/month labels, pulsing live-candle beacon, gradient fog-of-war' },
      { type: 'new', text: 'Stream health border — ambient WebSocket quality glow (green/amber/red) + latency badge' },
      { type: 'new', text: 'State architecture diagram with Mermaid — 35+ Zustand stores across 5 domain groups' },
      { type: 'new', text: 'Launch playbook — Product Hunt, Discord server structure, Reddit templates, Twitter thread' },
      { type: 'polish', text: 'README rewrite — hero section, feature table, quick start, tech stack, contributing' },
      { type: 'polish', text: 'Getting Started guide — prerequisites, .env setup, verified commands' },
      { type: 'polish', text: 'JSDoc configuration schema — @typedef ChartConfig with 14 documented fields' },
      { type: 'perf', text: 'CI gates — axe-core accessibility, frame-time regression, web-vitals (LCP/CLS), benchmark guards' },
      { type: 'perf', text: 'Benchmark CI job expanded — 10% threshold guards for CacheManager, DataValidator, SWR' },
    ],
  },
  {
    version: '11.0.0',
    date: '2026-03-01',
    tag: 'major',
    title: 'charEdge Launch',
    items: [
      { type: 'new', text: 'Complete rebrand: charEdge → charEdge with ember/steel design language' },
      { type: 'new', text: 'Charolette memorial page, star particle loading animation, and "Charolette\'s Light" achievement' },
      { type: 'new', text: 'Smart Insights — educational trading analysis with psychology insights' },
      { type: 'new', text: 'Guided Tour — 8-step onboarding for new users' },
      { type: 'new', text: '"Simple Mode" toggle — hide advanced features for focused trading' },
      { type: 'new', text: 'Bottom sheet system with 30%/50%/90% snap points for mobile' },
      { type: 'new', text: 'Swipeable dashboard sections with dot pagination' },
      { type: 'new', text: 'MetricInfo tooltips for Sharpe, Sortino, Kelly, Profit Factor, Max Drawdown' },
      { type: 'new', text: 'GDPR cookie consent with granular analytics/functional controls' },
      { type: 'new', text: 'Core Web Vitals reporter (FCP, LCP, CLS) wired to analytics' },
      { type: 'new', text: 'JSON-LD structured data for SEO on public pages' },
      { type: 'polish', text: 'Sprint 5 motion design: count-up hero stats, modal scale+fade, toast pause-on-hover' },
      { type: 'polish', text: 'Light theme full parity — 50+ component overrides, 21 color variables' },
      { type: 'polish', text: 'Responsive typography — 15px mobile base with clamp() type scale' },
      { type: 'perf', text: 'Framer Motion code-split to 31.73 kB chunk (11 kB gzip)' },
      { type: 'perf', text: 'content-visibility: auto on lazy widgets, GPU-composited animations' },
      { type: 'perf', text: '2,000+ trade stress test passing under 500ms' },
      { type: 'fix', text: 'WCAG AA contrast — tertiary text bumped to ≥4.5:1 ratio in both themes' },
      { type: 'fix', text: 'Touch targets enforced ≥44×44px on coarse pointer devices' },
      { type: 'fix', text: 'Focus-visible rings on all interactive elements' },
    ],
  },
  {
    version: '10.0.0',
    date: '2026-02-15',
    tag: 'major',
    title: 'charEdge v10',
    items: [
      { type: 'new', text: 'Custom charting engine — candlestick, OHLC, line, area, Heikin-Ashi, footprint, Renko' },
      { type: 'new', text: '22 technical indicators: RSI, MACD, Bollinger, Ichimoku, Supertrend, and more' },
      { type: 'new', text: 'Gamification system — XP, levels, achievements, streaks, quests, challenges' },
      { type: 'new', text: 'Psychology trading journal with mood tracking and cognitive bias detection' },
      { type: 'new', text: 'Multi-exchange support: Binance, Yahoo Finance, CoinGecko' },
      { type: 'polish', text: 'Redesigned sidebar with icon-only collapsed mode and hover expand' },
      { type: 'perf', text: 'IndexedDB caching with OPFS for large datasets' },
      { type: 'fix', text: 'Trade import deduplication with reconciliation engine' },
    ],
  },
];

// ─── Type Labels ────────────────────────────────────────────────
// Read from C.* tokens at render time (theme-reactive)

function getTypeConfig() {
  return {
    new: { emoji: '✨', label: 'New', color: C.g },
    fix: { emoji: '🔧', label: 'Fix', color: C.r },
    polish: { emoji: '🎨', label: 'Polish', color: C.p },
    perf: { emoji: '⚡', label: 'Perf', color: C.y },
  };
}

function getTagStyles() {
  return {
    major: { bg: `${C.b}20`, color: C.b, label: 'Major' },
    minor: { bg: `${C.g}20`, color: C.g, label: 'Minor' },
    patch: { bg: `${C.t3}20`, color: C.t3, label: 'Patch' },
  };
}

// ─── Component ──────────────────────────────────────────────────

export default function ChangelogPage() {
  const [expandedVersion, setExpandedVersion] = useState(CHANGELOG_ENTRIES[0]?.version);

  const toggleVersion = useCallback((version) => {
    setExpandedVersion((prev) => (prev === version ? null : version));
  }, []);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: F,
        padding: '40px 24px 64px',
      }}
    >
      {/* ─── Header ──────────────────────────────────────── */}
      <div style={{ maxWidth: 640, width: '100%', marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.t1,
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          What's New
        </h1>
        <p
          style={{
            fontSize: 14,
            color: C.t3,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Release notes and improvements to charEdge.
        </p>
      </div>

      {/* ─── Entries ─────────────────────────────────────── */}
      <div style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CHANGELOG_ENTRIES.map((entry) => {
          const isExpanded = expandedVersion === entry.version;
          const tagStyle = getTagStyles()[entry.tag] || getTagStyles().patch;

          return (
            <div
              key={entry.version}
              style={{
                background: C.sf,
                border: `1px solid ${isExpanded ? C.bd2 : C.bd}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.2s ease',
              }}
            >
              {/* Version Header */}
              <button
                onClick={() => toggleVersion(entry.version)}
                aria-expanded={isExpanded}
                aria-controls={`changelog-${entry.version}`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 20px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Version badge */}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: M,
                    color: C.t1,
                    minWidth: 56,
                  }}
                >
                  v{entry.version}
                </span>

                {/* Tag */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: tagStyle.bg,
                    color: tagStyle.color,
                  }}
                >
                  {tagStyle.label}
                </span>

                {/* Title */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.t2,
                    flex: 1,
                  }}
                >
                  {entry.title}
                </span>

                {/* Date */}
                <span
                  style={{
                    fontSize: 11,
                    color: C.t3,
                    fontFamily: M,
                  }}
                >
                  {entry.date}
                </span>

                {/* Expand indicator */}
                <span
                  style={{
                    fontSize: 12,
                    color: C.t3,
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {/* Expandable content */}
              {isExpanded && (
                <div
                  id={`changelog-${entry.version}`}
                  role="region"
                  aria-label={`Changes in version ${entry.version}`}
                  style={{
                    padding: '0 20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    borderTop: `1px solid ${C.bd}`,
                  }}
                >
                  {/* Group items by type */}
                  {['new', 'polish', 'perf', 'fix'].map((type) => {
                    const items = entry.items.filter((item) => item.type === type);
                    if (items.length === 0) return null;
                    const config = getTypeConfig()[type];

                    return (
                      <div key={type} style={{ marginTop: 12 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: config.color,
                            marginBottom: 6,
                          }}
                        >
                          {config.emoji} {config.label}
                        </div>
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: C.t2,
                              padding: '3px 0 3px 16px',
                              position: 'relative',
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 7,
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                background: config.color,
                                opacity: 0.5,
                              }}
                            />
                            {item.text}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Footer ──────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 640,
          width: '100%',
          textAlign: 'center',
          marginTop: 40,
          paddingTop: 24,
          borderTop: `1px solid ${C.bd}`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: C.t3,
            fontFamily: M,
            letterSpacing: '0.04em',
          }}
        >
          charEdge ✦ Find Your Edge.
        </span>
      </div>

    </div>
  );
}
