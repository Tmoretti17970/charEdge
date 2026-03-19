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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: `1px solid ${C.bd}`,
        background: C.bg2,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Play Controls */}
      <div style={{ display: 'flex', gap: 2 }}>
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
      <div style={{ display: 'flex', gap: 1 }}>
        {SPEEDS.map((s, i) => (
          <button
            className="tf-btn"
            key={s.label}
            onClick={() => setSpeedIdx(i)}
            style={{
              padding: '3px 6px',
              borderRadius: 3,
              border: 'none',
              background: speedIdx === i ? C.b + '25' : 'transparent',
              color: speedIdx === i ? C.b : C.t3,
              fontSize: 9,
              fontWeight: 700,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Divider />

      {/* Progress Slider */}
      <input
        type="range"
        min={2}
        max={totalBars - 1}
        value={replayIdx}
        onChange={(e) => setReplayIdx(parseInt(e.target.value))}
        style={{
          width: 120,
          accentColor: C.b,
          cursor: 'pointer',
          height: 4,
        }}
      />
      <span style={{ fontSize: 9, fontFamily: M, color: C.t3, minWidth: 45 }}>
        {replayIdx}/{totalBars - 1} ({progress}%)
      </span>

      <Divider />

      {/* Ghost Trade Controls */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <button
          className="tf-btn"
          onClick={() => setGhostSide(ghostSide === 'long' ? 'short' : 'long')}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${ghostSide === 'long' ? C.g : C.r}`,
            background: (ghostSide === 'long' ? C.g : C.r) + '15',
            color: ghostSide === 'long' ? C.g : C.r,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: M,
            cursor: 'pointer',
          }}
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
        <span style={{ fontSize: 10, fontFamily: M, color: C.y }}>
          {activeGhost.side.toUpperCase()} @ {activeGhost.entry.toFixed(2)}
          {' → '}
          <span
            style={{
              color:
                (activeGhost.side === 'long'
                  ? currentBar.close - activeGhost.entry
                  : activeGhost.entry - currentBar.close) >= 0
                  ? C.g
                  : C.r,
              fontWeight: 700,
            }}
          >
            {(activeGhost.side === 'long'
              ? currentBar.close - activeGhost.entry
              : activeGhost.entry - currentBar.close
            ).toFixed(2)}
          </span>
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Backtest Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: M }}>
          <span>
            <span style={{ color: C.t3 }}>Trades: </span>
            <span style={{ color: C.t1, fontWeight: 700 }}>{stats.count}</span>
          </span>
          <span>
            <span style={{ color: C.t3 }}>P&L: </span>
            <span style={{ color: stats.totalPnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(stats.totalPnl)}</span>
          </span>
          <span>
            <span style={{ color: C.t3 }}>Win: </span>
            <span style={{ color: stats.wr >= 50 ? C.g : C.r, fontWeight: 700 }}>{stats.wr.toFixed(0)}%</span>
          </span>
        </div>
      )}

      {/* Exit Replay */}
      <Btn variant="ghost" onClick={toggleReplay} style={{ fontSize: 10, padding: '4px 10px' }}>
        Exit Replay
      </Btn>

      {/* J2.7: Upcoming trade annotations indicator */}
      {upcomingCount > 0 && (
        <span style={{ fontSize: 9, fontFamily: M, color: C.p, fontWeight: 600 }}>
          📝 {upcomingCount} trade{upcomingCount > 1 ? 's' : ''} ahead
        </span>
      )}

      {/* J2.7: Current bar trade annotation overlay */}
      {currentAnnotations.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 12,
            right: 12,
            zIndex: 100,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            padding: '8px 0',
          }}
        >
          {currentAnnotations.map((trade, i) => (
            <div
              key={trade.id || i}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: C.sf2,
                border: `1px solid ${trade.pnl >= 0 ? C.g : C.r}40`,
                borderLeft: `3px solid ${trade.pnl >= 0 ? C.g : C.r}`,
                maxWidth: 320,
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontFamily: M,
                    color: trade.pnl >= 0 ? C.g : C.r,
                  }}
                >
                  {trade.side?.toUpperCase() || '—'} {fmtD(trade.pnl)}
                </span>
                {trade.playbook && <span style={{ fontSize: 9, color: C.b, fontWeight: 600 }}>{trade.playbook}</span>}
                {trade.emotion && <span style={{ fontSize: 9, color: C.t3 }}>{trade.emotion}</span>}
                {trade.rMultiple != null && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: M,
                      fontWeight: 700,
                      color: trade.rMultiple >= 0 ? C.g : C.r,
                    }}
                  >
                    {trade.rMultiple > 0 ? '+' : ''}
                    {trade.rMultiple.toFixed(1)}R
                  </span>
                )}
              </div>
              {trade.notes && (
                <div
                  style={{
                    fontSize: 10,
                    color: C.t2,
                    lineHeight: 1.4,
                    maxHeight: 40,
                    overflow: 'hidden',
                  }}
                >
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
      className="tf-btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '4px 8px',
        borderRadius: 4,
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '20' : 'transparent',
        color: disabled ? C.t3 + '40' : active ? C.b : C.t2,
        fontSize: 11,
        cursor: disabled ? 'default' : 'pointer',
        fontWeight: 600,
        fontFamily: M,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: C.bd, margin: '0 2px' }} />;
}

export { ReplayBar };
