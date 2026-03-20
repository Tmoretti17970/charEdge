// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Replay Control Bar
// Walk-forward backtest controls: play/pause, step, speed, ghost trades
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { C, M } from '@/constants.js';
import { useJournalStore } from '../../../../state/useJournalStore';
import { fmtD } from '../../../../utils.js';
import { useChartBars } from '../../../hooks/useChartBars.js';
import { Btn } from '../../ui/UIKit.jsx';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import s from './ReplayBar.module.css';

const SPEEDS = [
  { label: '0.5×', ms: 1000 },
  { label: '1×', ms: 500 },
  { label: '2×', ms: 250 },
  { label: '4×', ms: 125 },
  { label: '8×', ms: 60 },
];

export default function ReplayBar() {
  const replayMode = useChartFeaturesStore((s) => s.replayMode);
  const replayIdx = useChartFeaturesStore((s) => s.replayIdx);
  const replayPlaying = useChartFeaturesStore((s) => s.replayPlaying);
  const data = useChartBars();
  const backtestTrades = useChartFeaturesStore((s) => s.backtestTrades);
  const activeGhost = useChartFeaturesStore((s) => s.activeGhost);

  const setReplayIdx = useChartFeaturesStore((s) => s.setReplayIdx);
  const setReplayPlaying = useChartFeaturesStore((s) => s.setReplayPlaying);
  const addBacktestTrade = useChartFeaturesStore((s) => s.addBacktestTrade);
  const setActiveGhost = useChartFeaturesStore((s) => s.setActiveGhost);
  const toggleReplay = useChartFeaturesStore((s) => s.toggleReplay);

  const [speedIdx, setSpeedIdx] = useState(1);
  const [ghostSide, setGhostSide] = useState('long');
  const intervalRef = useRef(null);

  const totalBars = data?.length || 0;

  // Auto-play timer
  useEffect(() => {
    if (replayPlaying && replayIdx < totalBars - 1) {
      intervalRef.current = setInterval(() => {
        const current = useChartFeaturesStore.getState().replayIdx;
        const max = (useChartCoreStore.getState().barCount || 1) - 1;
        if (current >= max) {
          useChartFeaturesStore.getState().setReplayPlaying(false);
        } else {
          useChartFeaturesStore.getState().setReplayIdx(current + 1);
        }
      }, SPEEDS[speedIdx].ms);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [replayPlaying, speedIdx, totalBars, replayIdx]);

  // Stop playing at end
  useEffect(() => {
    if (replayIdx >= totalBars - 1 && replayPlaying) {
      setReplayPlaying(false);
    }
  }, [replayIdx, totalBars, replayPlaying, setReplayPlaying]);

  // Place ghost trade at current bar
  const handlePlaceEntry = useCallback(() => {
    if (!data || replayIdx < 0) return;
    const bar = data[replayIdx];
    if (!bar) return;

    if (activeGhost) {
      // Close the ghost trade
      const exitPrice = bar.close;
      const entryPrice = activeGhost.entry;
      const pnl = activeGhost.side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;

      addBacktestTrade({
        side: activeGhost.side,
        entry: entryPrice,
        exit: exitPrice,
        pnl,
        entryIdx: activeGhost.entryIdx,
        exitIdx: replayIdx,
        entryTime: data[activeGhost.entryIdx]?.date,
        exitTime: bar.date,
      });
      setActiveGhost(null);
    } else {
      // Open a ghost trade
      setActiveGhost({
        side: ghostSide,
        entry: bar.close,
        entryIdx: replayIdx,
      });
    }
  }, [data, replayIdx, activeGhost, ghostSide, addBacktestTrade, setActiveGhost]);

  // J2.7: Match journal trades to replay bars for annotations
  const journalTrades = useJournalStore((s) => s.trades);
  const currentSymbol = useChartCoreStore((s) => s.symbol);

  // Build a map of bar-time → journal trade for current symbol
  const tradeAnnotations = useMemo(() => {
    if (!data?.length || !journalTrades?.length || !currentSymbol) return new Map();
    const map = new Map();
    // Filter journal trades to current symbol
    const symbolTrades = journalTrades.filter(
      (t) => (t.symbol || '').toUpperCase() === (currentSymbol || '').toUpperCase(),
    );
    if (!symbolTrades.length) return map;

    // For each bar, check if any trade matches (same date, within an hour)
    for (let i = 0; i < data.length; i++) {
      const barTime = new Date(data[i].time).getTime();
      for (const trade of symbolTrades) {
        if (!trade.date) continue;
        const tradeTime = new Date(trade.date).getTime();
        // Match if within 1 bar's time range (generous matching)
        const threshold =
          i > 0 && data[i - 1]
            ? Math.abs(new Date(data[i].time).getTime() - new Date(data[i - 1].time).getTime()) * 0.6
            : 3600000; // 1 hour default
        if (Math.abs(barTime - tradeTime) <= threshold) {
          if (!map.has(i)) map.set(i, []);
          map.get(i).push(trade);
        }
      }
    }
    return map;
  }, [data, journalTrades, currentSymbol]);

  // Current bar's annotations
  const currentAnnotations = tradeAnnotations.get(replayIdx) || [];
  // Upcoming annotations (next 5 bars)
  const upcomingCount = useMemo(() => {
    let count = 0;
    for (let i = replayIdx + 1; i < Math.min(replayIdx + 20, totalBars); i++) {
      if (tradeAnnotations.has(i)) count++;
    }
    return count;
  }, [replayIdx, tradeAnnotations, totalBars]);

  // Backtest stats
  const stats = useMemo(() => {
    if (!backtestTrades.length) return null;
    const totalPnl = backtestTrades.reduce((s, t) => s + t.pnl, 0);
    const wins = backtestTrades.filter((t) => t.pnl > 0).length;
    const losses = backtestTrades.filter((t) => t.pnl <= 0).length;
    const wr = backtestTrades.length > 0 ? (wins / backtestTrades.length) * 100 : 0;
    return { totalPnl, wins, losses, wr, count: backtestTrades.length };
  }, [backtestTrades]);

  if (!replayMode) return null;

  const progress = totalBars > 1 ? ((replayIdx / (totalBars - 1)) * 100).toFixed(0) : 0;
  const currentBar = data?.[replayIdx];

  return (
    <div className={s.bar}>
      {/* Play Controls */}
      <div className={s.playGroup}>
        <CtrlBtn onClick={() => setReplayIdx(Math.max(2, replayIdx - 1))} title="Step back" disabled={replayIdx <= 2}>
          ◀
        </CtrlBtn>
        <CtrlBtn
          onClick={() => setReplayPlaying(!replayPlaying)}
          title={replayPlaying ? 'Pause' : 'Play'}
          active={replayPlaying}
        >
          {replayPlaying ? '⏸' : '▶'}
        </CtrlBtn>
        <CtrlBtn
          onClick={() => setReplayIdx(Math.min(totalBars - 1, replayIdx + 1))}
          title="Step forward"
          disabled={replayIdx >= totalBars - 1}
        >
          ▶
        </CtrlBtn>
      </div>

      {/* Speed */}
      <div className={s.speedGroup}>
        {SPEEDS.map((sp, i) => (
          <button
            className={`tf-btn ${s.speedBtn}`}
            key={sp.label}
            onClick={() => setSpeedIdx(i)}
            data-active={speedIdx === i || undefined}
          >
            {sp.label}
          </button>
        ))}
      </div>

      <div className={s.divider} />

      {/* Progress Slider */}
      <input
        type="range"
        min={2}
        max={totalBars - 1}
        value={replayIdx}
        onChange={(e) => setReplayIdx(parseInt(e.target.value))}
        className={s.progressSlider}
      />
      <span className={s.progressLabel}>
        {replayIdx}/{totalBars - 1} ({progress}%)
      </span>

      <div className={s.divider} />

      {/* Ghost Trade Controls */}
      <div className={s.ghostGroup}>
        <button
          className={`tf-btn ${s.ghostSideBtn}`}
          onClick={() => setGhostSide(ghostSide === 'long' ? 'short' : 'long')}
          style={{ '--ghost-color': ghostSide === 'long' ? C.g : C.r }}
        >
          {ghostSide === 'long' ? '▲ LONG' : '▼ SHORT'}
        </button>

        <CtrlBtn
          onClick={handlePlaceEntry}
          active={!!activeGhost}
          title={activeGhost ? 'Close position' : 'Open position at current bar'}
        >
          {activeGhost ? '✕ Close' : '+ Entry'}
        </CtrlBtn>
      </div>

      {/* Active Ghost Indicator */}
      {activeGhost && currentBar && (
        <span className={s.ghostIndicator}>
          {activeGhost.side.toUpperCase()} @ {activeGhost.entry.toFixed(2)}
          {' → '}
          <span
            className={s.ghostPL}
            style={{
              color:
                (activeGhost.side === 'long'
                  ? currentBar.close - activeGhost.entry
                  : activeGhost.entry - currentBar.close) >= 0
                  ? C.g
                  : C.r,
            }}
          >
            {(activeGhost.side === 'long'
              ? currentBar.close - activeGhost.entry
              : activeGhost.entry - currentBar.close
            ).toFixed(2)}
          </span>
        </span>
      )}

      <div className={s.spacer} />

      {/* Backtest Stats */}
      {stats && (
        <div className={s.stats}>
          <span>
            <span className={s.statLabel}>Trades: </span>
            <span className={s.statValue}>{stats.count}</span>
          </span>
          <span>
            <span className={s.statLabel}>P&L: </span>
            <span className={s.statValue} style={{ color: stats.totalPnl >= 0 ? C.g : C.r }}>{fmtD(stats.totalPnl)}</span>
          </span>
          <span>
            <span className={s.statLabel}>Win: </span>
            <span className={s.statValue} style={{ color: stats.wr >= 50 ? C.g : C.r }}>{stats.wr.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Exit Replay */}
      <Btn variant="ghost" onClick={toggleReplay} style={{ fontSize: 10, padding: '4px 10px' }}>
        Exit Replay
      </Btn>

      {/* J2.7: Upcoming trade annotations indicator */}
      {upcomingCount > 0 && (
        <span className={s.upcomingBadge}>
          📝 {upcomingCount} trade{upcomingCount > 1 ? 's' : ''} ahead
        </span>
      )}

      {/* J2.7: Current bar trade annotation overlay */}
      {currentAnnotations.length > 0 && (
        <div className={s.annotationOverlay}>
          {currentAnnotations.map((trade, i) => (
            <div
              key={trade.id || i}
              className={s.annotationCard}
              style={{
                border: `1px solid ${trade.pnl >= 0 ? C.g : C.r}40`,
                borderLeft: `3px solid ${trade.pnl >= 0 ? C.g : C.r}`,
              }}
            >
              <div className={s.annotationHeader}>
                <span className={s.annotationPL} style={{ color: trade.pnl >= 0 ? C.g : C.r }}>
                  {trade.side?.toUpperCase() || '—'} {fmtD(trade.pnl)}
                </span>
                {trade.playbook && <span className={s.annotationPlaybook}>{trade.playbook}</span>}
                {trade.emotion && <span className={s.annotationEmotion}>{trade.emotion}</span>}
                {trade.rMultiple != null && (
                  <span className={s.annotationR} style={{ color: trade.rMultiple >= 0 ? C.g : C.r }}>
                    {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                  </span>
                )}
              </div>
              {trade.notes && (
                <div className={s.annotationNotes}>
                  {trade.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function CtrlBtn({ children, onClick, title, disabled, active }) {
  return (
    <button
      className={`tf-btn ${s.ctrlBtn}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-active={active || undefined}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className={s.divider} />;
}

export { ReplayBar };
