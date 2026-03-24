// ═══════════════════════════════════════════════════════════════════
// charEdge — Empty State System (Redesign)
//
// Three tiers:
//   1. Aspirational: Shows a blurred preview of the filled page
//   2. Milestone: Shows progress toward unlocking features
//   3. Minimal: Simple text for inline widget empty states
//
// All empty states include a clear CTA and feel like a doorway,
// not a dead end.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';
import { space, radii, text } from '../../../theme/tokens.js';
import { Card, Btn } from './UIKit.jsx';
import s from './EmptyState.module.css';

// ─── Core EmptyState (enhanced) ─────────────────────────────────

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  children,
  preview,
}) {
  return (
    <Card className={`tf-fade-scale ${s.s0}`}>
      {/* Aspirational preview (blurred mockup) */}
      {preview && (
        <div className={s.previewWrap}>
          <div className={s.s1}>{preview}</div>
          <div
            className={s.previewOverlay}
            style={{ background: `linear-gradient(to bottom, transparent 40%, ${C.bg})` }}
          />
          <div className={s.previewBadge}>Preview</div>
        </div>
      )}

      <div className={s.contentPad}>
        {icon && (
          <div
            className={s.iconWrap}
            style={{
              background: `linear-gradient(135deg, ${C.b}15, ${C.y}10)`,
              border: `1px solid ${C.b}20`,
            }}
          >
            {icon}
          </div>
        )}

        <h3 className={s.title} style={{ ...text.h2 }}>{title}</h3>

        <p className={s.message} style={{ ...text.body }}>{message}</p>

        {(actionLabel || secondaryLabel) && (
          <div className={s.actionRow}>
            {actionLabel && <Btn onClick={onAction}>{actionLabel}</Btn>}
            {secondaryLabel && (
              <Btn onClick={onSecondary} variant="ghost">
                {secondaryLabel}
              </Btn>
            )}
          </div>
        )}

        {children}
      </div>
    </Card>
  );
}

// ─── Dashboard Empty State ──────────────────────────────────────

export function DashboardEmptyState({ onGoToJournal, onImportTrades }) {
  return (
    <EmptyState
      icon="📊"
      title="Your Trading Story Starts Here"
      message="Log your first trade to unlock performance analytics, equity tracking, and personalized insights."
      actionLabel="Log Your First Trade →"
      onAction={onGoToJournal}
      secondaryLabel={onImportTrades ? "📥 Import Trades" : undefined}
      onSecondary={onImportTrades}
      preview={<DashboardPreview />}
    >
      <FeatureRoadmap
        items={[
          { trades: 1, label: 'Basic P&L tracking', icon: '📈' },
          { trades: 5, label: 'Win rate & streak analysis', icon: '🎯' },
          { trades: 20, label: 'Advanced metrics & patterns', icon: '🧠' },
          { trades: 50, label: 'Monte Carlo & risk models', icon: '🔬' },
        ]}
        current={0}
      />
    </EmptyState>
  );
}

// ─── Journal Empty State ────────────────────────────────────────

export function JournalEmptyState({ onAddTrade, onImportCSV }) {
  return (
    <EmptyState
      icon="📒"
      title="Start Building Your Edge"
      message="Every trade tells a story. Log your trades with context, strategy, and emotions to find patterns that move the needle."
      actionLabel="+ Add First Trade"
      onAction={onAddTrade}
      secondaryLabel="📁 Import CSV"
      onSecondary={onImportCSV}
      preview={<JournalPreview />}
    >
      <div className={s.tipsBox}>
        <div className={s.tipsLabel} style={{ ...text.label }}>Quick Start Tips</div>
        <TipItem text="Log trades right after closing — emotions are freshest" />
        <TipItem text="Add your strategy name to unlock pattern detection" />
        <TipItem text="Track emotional state to spot tilt before it costs you" />
        <TipItem text="Import broker CSVs for instant historical analysis" />
      </div>
    </EmptyState>
  );
}

// ─── Insights Empty State ───────────────────────────────────────

export function InsightsEmptyState({ onGoToJournal }) {
  return (
    <EmptyState
      icon="🔬"
      title="Intelligence Unlocks With Data"
      message="The more you trade and log, the smarter your insights become. Each trade adds a data point to your edge."
      actionLabel="Start Logging Trades →"
      onAction={onGoToJournal}
    >
      <FeatureRoadmap
        items={[
          { trades: 1, label: 'Strategy overview', icon: '📋' },
          { trades: 10, label: 'Timing & psychology analysis', icon: '🧠' },
          { trades: 25, label: 'Playbook pattern matching', icon: '📚' },
          { trades: 50, label: 'Full risk modeling suite', icon: '🔬' },
        ]}
        current={0}
      />
    </EmptyState>
  );
}

// ─── Charts Empty State (for when no data loads) ────────────────

export function ChartsEmptyState({ _onSearch }) {
  return (
    <EmptyState
      icon="📈"
      title="Search a Symbol to Begin"
      message="Type a ticker symbol above to load real-time charts with indicators, drawing tools, and trade overlays."
    />
  );
}

// ─── Notes Empty State ──────────────────────────────────────────

export function NotesEmptyState({ onNewNote }) {
  return (
    <EmptyState
      icon="✏️"
      title="Capture Your Thoughts"
      message="Market observations, trade reviews, daily reflections — your notes become searchable context for future decisions."
      actionLabel="Write First Note"
      onAction={onNewNote}
    />
  );
}

// ─── Inline Widget Empty State (minimal, for cards) ──────────────

export function WidgetEmptyState({ message, actionLabel, onAction }) {
  return (
    <div className={s.widgetWrap}>
      <div style={{ marginBottom: actionLabel ? 12 : 0 }}>{message}</div>
      {actionLabel && onAction && (
        <button onClick={onAction} className={`tf-link ${s.widgetBtn}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Milestone Progress Component ───────────────────────────────

export function MilestoneBar({ tradeCount }) {
  const milestones = [
    { count: 1, label: 'First trade' },
    { count: 10, label: 'Getting started' },
    { count: 25, label: 'Building habits' },
    { count: 50, label: 'Pattern detection' },
    { count: 100, label: 'Statistical edge' },
  ];

  const nextMilestone = milestones.find((m) => tradeCount < m.count);
  if (!nextMilestone) return null;

  const prevCount = milestones[milestones.indexOf(nextMilestone) - 1]?.count || 0;
  const progress = Math.min(((tradeCount - prevCount) / (nextMilestone.count - prevCount)) * 100, 100);

  return (
    <div className={s.milestoneWrap}>
      <div className={s.s2}>
        <span className={s.milestoneCount}>
          {tradeCount} / {nextMilestone.count} trades
        </span>
        <span className={s.milestoneLabel}>{nextMilestone.label}</span>
      </div>
      <div className={s.milestoneTrack}>
        <div
          className={s.milestoneFill}
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${C.b}, ${C.y})`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Feature Roadmap (shows what unlocks at each tier) ───────────

function FeatureRoadmap({ items, current }) {
  return (
    <div className={s.roadmapWrap}>
      <div className={s.roadmapLabel} style={{ ...text.label }}>What unlocks as you trade</div>
      {items.map((item, i) => {
        const unlocked = current >= item.trades;
        return (
          <div
            key={i}
            className={`tf-stagger-${i + 1} ${s.roadmapItem}`}
            style={{ background: unlocked ? C.b + '08' : 'transparent' }}
          >
            <div
              className={s.roadmapIcon}
              style={{ background: unlocked ? C.b + '20' : C.bd + '30' }}
            >
              {unlocked ? '✓' : item.icon}
            </div>
            <div className={s.s3}>
              <div
                className={s.roadmapItemLabel}
                style={{ fontWeight: unlocked ? 600 : 500, color: unlocked ? C.t1 : C.t3 }}
              >
                {item.label}
              </div>
            </div>
            <div
              className={s.roadmapBadge}
              style={{ color: unlocked ? C.g : C.t3, background: unlocked ? C.g + '15' : C.bd + '20' }}
            >
              {item.trades}+
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Aspirational Previews ──────────────────────────────────────
// Lightweight SVG/div mockups showing what the page looks like
// when populated. These are intentionally abstract/blurred.

function DashboardPreview() {
  return (
    <div className={s.s4}>
      <div className={s.heroStat} style={{ background: C.g + '15' }}>
        <div className={s.heroLabel}>Today's P&L</div>
        <div className={s.heroValue} style={{ color: C.g }}>+$1,247.50</div>
      </div>
      <div className={s.s5}>
        <div className={s.secondaryStat}>
          <div className={s.secondaryLabel}>Win Rate</div>
          <div className={s.secondaryValue}>68%</div>
        </div>
        <div className={s.secondaryStat}>
          <div className={s.secondaryLabel}>Trades</div>
          <div className={s.secondaryValue}>12</div>
        </div>
      </div>
      <div className={s.equityWrap}>
        <div className={s.equityLabel}>Equity Curve</div>
        <svg width="100%" height="80" viewBox="0 0 200 80" preserveAspectRatio="none">
          <path
            d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 30 L120 35 L140 22 L160 18 L180 25 L200 10"
            fill="none"
            stroke={C.g}
            strokeWidth="2"
            opacity="0.7"
          />
          <path
            d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 30 L120 35 L140 22 L160 18 L180 25 L200 10 L200 80 L0 80"
            fill={C.g + '10'}
            stroke="none"
          />
        </svg>
      </div>
    </div>
  );
}

function JournalPreview() {
  const rows = [
    { sym: 'AAPL', side: 'long', pnl: '+$342.00', color: C.g },
    { sym: 'TSLA', side: 'short', pnl: '-$128.50', color: C.r },
    { sym: 'NVDA', side: 'long', pnl: '+$567.25', color: C.g },
    { sym: 'SPY', side: 'long', pnl: '+$89.00', color: C.g },
  ];
  return (
    <div className={s.journalWrap}>
      {rows.map((r, i) => (
        <div key={i} className={s.journalRow}>
          <div className={s.s6}>
            <span className={s.journalSym}>{r.sym}</span>
            <span className={s.journalSide} style={{ color: r.side === 'long' ? C.g : C.r }}>
              {r.side}
            </span>
          </div>
          <span className={s.journalPnl} style={{ color: r.color }}>{r.pnl}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Helpers ─────────────────────────────────────────────

function TipItem({ text: label }) {
  return (
    <div className={s.tipRow}>
      <span className={s.tipDot}>●</span>
      <span className={s.tipText}>{label}</span>
    </div>
  );
}

function _MetricPreview({ label }) {
  return (
    <div className={s.metricWrap}>
      <div style={{ ...text.captionSm, marginBottom: 2 }}>{label}</div>
      <div className={s.metricValue}>—</div>
    </div>
  );
}

// ─── Sprint 13: Dashboard Widget Empty States ───────────────────

export function EquityCurveEmptyState({ onAddTrade }) {
  return (
    <WidgetEmptyState
      message="Your equity curve appears after your first trade. It reveals the shape of your edge over time."
      actionLabel="Log a trade to start tracking →"
      onAction={onAddTrade}
    />
  );
}

export function HeatmapEmptyState({ onAddTrade }) {
  return (
    <WidgetEmptyState
      message="The trade heatmap shows when you trade best. Log trades with timestamps to reveal your optimal windows."
      actionLabel="Start logging trades →"
      onAction={onAddTrade}
    />
  );
}

export function CalendarEmptyState({ onAddTrade }) {
  return (
    <WidgetEmptyState
      message="Your P&L calendar fills in as you log trades. See daily wins and losses at a glance."
      actionLabel="Add your first trade →"
      onAction={onAddTrade}
    />
  );
}

export function StreakEmptyState() {
  return (
    <WidgetEmptyState
      message="Trading streaks track consecutive winning days. Log trades to start building your streak."
    />
  );
}

// ─── Sprint 14: All-Page Empty States ───────────────────────────

export function WatchlistEmptyState({ onAddSymbol }) {
  return (
    <EmptyState
      icon="👁"
      title="Build Your Watchlist"
      message="Track the symbols that matter most. Add from search or click any symbol to start watching."
      actionLabel="+ Add Symbol"
      onAction={onAddSymbol}
    />
  );
}

export function AlertsEmptyState({ onCreateAlert }) {
  return (
    <EmptyState
      icon="🔔"
      title="Set Up Price Alerts"
      message="Get notified when symbols hit your levels. Alerts work across all your watched assets."
      actionLabel="Create First Alert"
      onAction={onCreateAlert}
    />
  );
}

export function PropFirmEmptyState({ onSetup }) {
  return (
    <EmptyState
      icon="🏢"
      title="Track Your Prop Firm Challenge"
      message="Monitor drawdown limits, profit targets, and rule compliance. Connect your prop firm account to get started."
      actionLabel="Set Up Prop Firm"
      onAction={onSetup}
    />
  );
}

export function ScreenerEmptyState({ onSearch }) {
  return (
    <EmptyState
      icon="🔍"
      title="No Matches Found"
      message="Try adjusting your filters or broadening your search criteria to find more symbols."
      actionLabel="Clear Filters"
      onAction={onSearch}
    />
  );
}

export function PlaybooksEmptyState({ onAddTrade }) {
  return (
    <EmptyState
      icon="📚"
      title="Strategies Emerge From Data"
      message="Tag your trades with strategy names and charEdge will automatically detect recurring patterns and build playbooks."
      actionLabel="Log a Trade With a Strategy →"
      onAction={onAddTrade}
    >
      <FeatureRoadmap
        items={[
          { trades: 5, label: 'First strategy detected', icon: '🏷' },
          { trades: 15, label: 'Win rate by strategy', icon: '📊' },
          { trades: 30, label: 'Optimal conditions analysis', icon: '🔬' },
        ]}
        current={0}
      />
    </EmptyState>
  );
}

export default React.memo(EmptyState);

