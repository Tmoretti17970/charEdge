// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade P/L Pill (Enhanced Live Positions)
// Floating pill showing live unrealized P&L with expandable dropdown.
// Toggle between current chart positions and all open positions.
// Includes weekly/monthly P&L stats and per-position detail.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useAllOpenPositions } from '../../../../hooks/useAllOpenPositions.js';
import { useOpenPositions } from '../../../../hooks/useOpenPositions.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useJournalStore } from '../../../../state/useJournalStore';

// ─── Helpers ─────────────────────────────────────────────────────

/** Format seconds into human-readable duration */
function formatDuration(ms) {
  if (ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return `${days}d ${remHrs}h`;
}

/** Check if a date falls within the current week (Mon–Sun) */
function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - mondayOffset);
  return d >= monday;
}

/** Check if a date falls within the current month */
function isThisMonth(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ═══════════════════════════════════════════════════════════════════

function TradePLPill({ showAutoFit, onAutoFit }) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'all'

  // ── Zustand selectors ──────────────────────────────────────
  const symbol = useChartCoreStore((s) => s.symbol);
  const aggregatedPrice = useChartCoreStore((s) => s.aggregatedPrice);
  const allTrades = useJournalStore((s) => s.trades);
  const updateTrade = useJournalStore((s) => s.updateTrade);

  // ── Open positions ──────────────────────────────────────────
  const chartPositions = useOpenPositions(symbol);
  const allPositions = useAllOpenPositions();

  const activePositions = viewMode === 'chart' ? chartPositions : allPositions;

  // ── Compute per-position stats ─────────────────────────────
  const now = Date.now();

  const positionDetails = useMemo(() => {
    if (!activePositions.length) return [];
    return activePositions.map((pos) => {
      const sym = (pos.symbol || '').toUpperCase();
      const currentSymbol = (symbol || '').toUpperCase();

      // Can only compute live P/L for positions matching the current chart symbol
      const isCurrentSymbol =
        sym === currentSymbol ||
        sym === currentSymbol + 'USDT' ||
        currentSymbol === sym + 'USDT' ||
        sym.includes(currentSymbol) ||
        currentSymbol.includes(sym);

      const hasPrice = isCurrentSymbol && aggregatedPrice;
      const currentPrice = hasPrice ? aggregatedPrice : null;
      const diff = currentPrice ? currentPrice - pos.entry : null;
      const pl = diff !== null ? diff * (pos.side === 'short' ? -1 : 1) : null;
      const pctChange = pl !== null && pos.entry ? (pl / pos.entry) * 100 : null;

      const openTime = new Date(pos.date).getTime();
      const duration = now - openTime;

      return {
        id: pos.id,
        symbol: pos.symbol,
        side: pos.side,
        entry: pos.entry,
        currentPrice,
        pl: pl !== null ? Math.round(pl * 100) / 100 : null,
        pctChange: pctChange !== null ? Math.round(pctChange * 100) / 100 : null,
        duration,
        durationStr: formatDuration(duration),
        hasPrice,
        stopLoss: pos.stopLoss || pos.context?.stopLoss || null,
        takeProfit: pos.takeProfit || pos.context?.takeProfit || null,
      };
    });
  }, [activePositions, aggregatedPrice, symbol, now]);

  // ── Totals ─────────────────────────────────────────────────
  const totalUnrealized = useMemo(() => {
    let total = 0;
    let hasPricedPositions = false;
    for (const p of positionDetails) {
      if (p.pl !== null) {
        total += p.pl;
        hasPricedPositions = true;
      }
    }
    return hasPricedPositions ? Math.round(total * 100) / 100 : null;
  }, [positionDetails]);

  // ── Weekly / Monthly P&L (closed trades) ───────────────────
  const periodStats = useMemo(() => {
    if (!allTrades?.length) return { week: 0, month: 0, weekCount: 0, monthCount: 0 };
    let week = 0,
      month = 0,
      weekCount = 0,
      monthCount = 0;
    for (const t of allTrades) {
      const pl = t.pnl ?? t.pl ?? t.profit ?? 0;
      if (pl === 0 && t.source === 'chart-quick-trade' && !t.exit && !t.exitPrice) continue;
      if (isThisWeek(t.date)) {
        week += pl;
        weekCount++;
      }
      if (isThisMonth(t.date)) {
        month += pl;
        monthCount++;
      }
    }
    return {
      week: Math.round(week * 100) / 100,
      month: Math.round(month * 100) / 100,
      weekCount,
      monthCount,
    };
  }, [allTrades]);

  // ── Close position handler ─────────────────────────────────
  const closePosition = useCallback(
    (posId) => {
      const pos = activePositions.find((p) => p.id === posId);
      if (!pos) return;
      const detail = positionDetails.find((p) => p.id === posId);
      updateTrade(posId, {
        pnl: detail?.pl ?? 0,
        exit: detail?.currentPrice ?? pos.entry,
        exitPrice: detail?.currentPrice ?? pos.entry,
        closeDate: new Date().toISOString(),
      });
    },
    [activePositions, positionDetails, updateTrade],
  );

  // ── Only render when positions exist ───────────────────────
  if (!allPositions.length) return null;

  const isPositive = totalUnrealized !== null ? totalUnrealized >= 0 : true;
  const pillColor = isPositive ? '#26A69A' : '#EF5350';
  const displayCount = viewMode === 'chart' ? chartPositions.length : allPositions.length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 68,
        zIndex: 80,
        fontFamily: F,
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Auto-Fit Button */}
      {showAutoFit && (
        <button
          onClick={onAutoFit}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: 'none',
            background: '#2962FF',
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            padding: 0,
            flexShrink: 0,
          }}
          title="Auto-fit price axis"
        >
          ⊞
        </button>
      )}

      {/* ── Live Position Pill ────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 16,
            border: `1px solid ${pillColor}40`,
            background: `${pillColor}12`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: pillColor,
            fontFamily: F,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: `0 2px 8px ${pillColor}20`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.03)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {/* Pulsing live dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: pillColor,
              boxShadow: `0 0 6px ${pillColor}`,
              animation: 'tfPulse 2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span>
            {totalUnrealized !== null
              ? `${isPositive ? '+' : ''}${totalUnrealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </span>
          <span style={{ opacity: 0.6, fontWeight: 500 }}>({displayCount} open)</span>
          <span
            style={{
              fontSize: 8,
              color: C.t3,
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
        </button>

        {/* ══════════ Expanded Dropdown ══════════ */}
        {expanded && (
          <div
            className="tf-fade-in"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              padding: 0,
              background: `${C.sf2}F5`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${C.bd}`,
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: 280,
              maxWidth: 340,
              animation: 'tfDropdownIn 0.15s ease-out',
              zIndex: 90,
              overflow: 'hidden',
            }}
          >
            {/* ── View Toggle: This Chart / All Positions ── */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                padding: '8px 10px 6px',
                borderBottom: `1px solid ${C.bd}`,
              }}
            >
              {['chart', 'all'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: F,
                    cursor: 'pointer',
                    letterSpacing: '0.3px',
                    background: viewMode === mode ? `${C.b}20` : 'transparent',
                    color: viewMode === mode ? C.b : C.t3,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'chart' ? `📊 This Chart` : `🌐 All Positions`}
                </button>
              ))}
            </div>

            {/* ── Open Positions Section ── */}
            <div style={{ padding: '8px 10px' }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  letterSpacing: '0.5px',
                  marginBottom: 6,
                }}
              >
                OPEN POSITIONS
              </div>

              {positionDetails.length === 0 ? (
                <div style={{ fontSize: 11, color: C.t3, padding: '8px 0', textAlign: 'center' }}>
                  No open positions{viewMode === 'chart' ? ' on this chart' : ''}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {positionDetails.map((pos) => {
                    const posColor = pos.pl !== null ? (pos.pl >= 0 ? '#26A69A' : '#EF5350') : C.t3;
                    return (
                      <div
                        key={pos.id}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: `${posColor}08`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        {/* Row 1: Symbol + Side + P/L */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>
                              {pos.symbol}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: pos.side === 'long' ? '#26A69A' : '#EF5350',
                                textTransform: 'uppercase',
                              }}
                            >
                              {pos.side === 'long' ? '▲' : '▼'} {pos.side}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {pos.pl !== null ? (
                              <>
                                <span style={{ fontSize: 12, fontWeight: 700, color: posColor, fontFamily: F }}>
                                  {pos.pl >= 0 ? '+' : ''}
                                  {pos.pl.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 600, color: posColor, opacity: 0.7 }}>
                                  ({pos.pctChange >= 0 ? '+' : ''}
                                  {pos.pctChange}%)
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 10, color: C.t3, fontStyle: 'italic' }}>no price</span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Entry → Current + Duration + Close */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>
                            {pos.entry.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            {pos.currentPrice && (
                              <>
                                <span style={{ margin: '0 3px', opacity: 0.4 }}>→</span>
                                {pos.currentPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </>
                            )}
                            <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                            <span style={{ color: C.t2 }}>⏱ {pos.durationStr}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closePosition(pos.id);
                            }}
                            title="Close position"
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: `1px solid ${C.r}40`,
                              background: `${C.r}10`,
                              color: C.r,
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: F,
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${C.r}25`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `${C.r}10`;
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total footer (only when > 1 position with price) */}
              {positionDetails.filter((p) => p.pl !== null).length > 1 && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: `1px solid ${C.bd}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: F }}>TOTAL</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pillColor, fontFamily: F }}>
                    {totalUnrealized !== null
                      ? `${isPositive ? '+' : ''}${totalUnrealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </div>
              )}
            </div>

            {/* ── Weekly / Monthly P&L Section ── */}
            <div
              style={{
                padding: '8px 10px 10px',
                borderTop: `1px solid ${C.bd}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  letterSpacing: '0.5px',
                  marginBottom: 6,
                }}
              >
                PERFORMANCE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <PerfStat label="This Week" value={periodStats.week} count={periodStats.weekCount} />
                <PerfStat label="This Month" value={periodStats.month} count={periodStats.monthCount} />
              </div>
            </div>

            {/* ── Close All (only when multiple positions) ── */}
            {positionDetails.length > 1 && (
              <div
                style={{
                  padding: '6px 10px 10px',
                  borderTop: `1px solid ${C.bd}`,
                }}
              >
                <button
                  onClick={() => {
                    positionDetails.forEach((p) => closePosition(p.id));
                    setExpanded(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 0',
                    borderRadius: 6,
                    border: `1px solid ${C.r}40`,
                    background: `${C.r}10`,
                    color: C.r,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: F,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${C.r}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${C.r}10`;
                  }}
                >
                  Close All ({positionDetails.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Performance Stat Cell ───────────────────────────────────────

function PerfStat({ label, value, count }) {
  const color = value >= 0 ? '#26A69A' : '#EF5350';
  return (
    <div
      style={{
        padding: '6px 8px',
        borderRadius: 6,
        background: `${color}08`,
      }}
    >
      <div style={{ fontSize: 9, color: C.t3, marginBottom: 2, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: F }}>
        {value >= 0 ? '+' : ''}
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{ fontSize: 8, color: C.t3, fontFamily: F, marginTop: 1 }}>
        {count} trade{count !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default React.memo(TradePLPill);
