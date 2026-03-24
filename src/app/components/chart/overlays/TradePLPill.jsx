// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade P/L Pill (Enhanced Live Positions)
// Floating pill showing live unrealized P&L with expandable dropdown.
// Toggle between current chart positions and all open positions.
// Includes weekly/monthly P&L stats and per-position detail.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { C } from '@/constants.js';
import { useAllOpenPositions } from '../../../../hooks/useAllOpenPositions.js';
import { useOpenPositions } from '../../../../hooks/useOpenPositions.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useJournalStore } from '../../../../state/useJournalStore';
import s from './TradePLPill.module.css';

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
      if (pl === 0 && ['chart-quick-trade', 'radial-menu'].includes(t.source) && !t.exit && !t.exitPrice) continue;
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
      const exitPrice = detail?.currentPrice ?? pos.entry;
      const pnl = detail?.pl ?? 0;
      const exitTime = Date.now();
      const entryTime = pos.entryTime || new Date(pos.date).getTime();
      const holdDuration = exitTime - entryTime;

      // Compute R-Multiple: PnL / risk-per-unit
      let rMultiple = null;
      const sl = pos.stopLoss || pos.context?.stopLoss;
      if (sl && pos.entry) {
        const riskPerUnit = Math.abs(pos.entry - sl);
        if (riskPerUnit > 0) {
          rMultiple = Math.round((pnl / riskPerUnit) * 100) / 100;
        }
      }

      // Capture close screenshot using the working composite capture
      let closeScreenshot = null;
      try {
        // Dynamic import to avoid adding to TradePLPill's bundle
        const sym = (pos.symbol || symbol || '').toUpperCase();
        const area = document.querySelector('.tf-chart-area');
        if (area) {
          const canvases = area.querySelectorAll('canvas');
          if (canvases.length) {
            const refCanvas = canvases[0];
            if (refCanvas && refCanvas.width > 0 && refCanvas.height > 0) {
              const w = refCanvas.width;
              const h = refCanvas.height;
              const offscreen = document.createElement('canvas');
              offscreen.width = w;
              offscreen.height = h;
              const ctx = offscreen.getContext('2d');
              if (ctx) {
                for (const canvas of canvases) {
                  if (canvas.width > 0 && canvas.height > 0) {
                    ctx.drawImage(canvas, 0, 0);
                  }
                }
                // Add "CLOSED" watermark
                const scale = window.devicePixelRatio || 1;
                const fs = Math.round(12 * scale);
                ctx.font = `bold ${fs}px Arial`;
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
                ctx.fillText(
                  `CLOSED ${pnlStr} · ${sym} · charEdge`,
                  w - Math.round(10 * scale),
                  h - Math.round(6 * scale),
                );
                const dataUrl = offscreen.toDataURL('image/png');
                closeScreenshot = { data: dataUrl, name: `${sym}_close_${Date.now()}.png` };
              }
            }
          }
        }
      } catch { /* non-fatal */ }

      // Build screenshots array: keep existing entry screenshots + add close screenshot
      const existingScreenshots = pos.screenshots || [];
      const newScreenshots = closeScreenshot
        ? [...existingScreenshots, closeScreenshot]
        : existingScreenshots;

      updateTrade(posId, {
        pnl,
        exit: exitPrice,
        exitPrice,
        closeDate: new Date().toISOString(),
        entryTime,
        exitTime,
        holdDuration,
        rMultiple,
        exitReason: 'manual',
        fees: pos.commission || 1.00,
        screenshots: newScreenshots.length > 0 ? newScreenshots : undefined,
      });
    },
    [activePositions, positionDetails, updateTrade, symbol],
  );

  // ── Only render when positions exist ───────────────────────
  if (!allPositions.length) return null;

  const isPositive = totalUnrealized !== null ? totalUnrealized >= 0 : true;
  const pillColor = isPositive ? '#26A69A' : '#EF5350';
  const displayCount = viewMode === 'chart' ? chartPositions.length : allPositions.length;

  return (
    <div className={s.root} style={{ '--pill-color': pillColor }}>
      {/* Auto-Fit Button */}
      {showAutoFit && (
        <button onClick={onAutoFit} className={s.autoFitBtn} title="Auto-fit price axis">⊞</button>
      )}

      {/* ── Live Position Pill ────────────────────────────────── */}
      <div className={s.pillWrap}>
        <button onClick={() => setExpanded(!expanded)} className={s.pillBtn}>
          <span className={s.pulseDot} />
          <span>
            {totalUnrealized !== null
              ? `${isPositive ? '+' : ''}${totalUnrealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </span>
          <span className={s.openCount}>({displayCount} open)</span>
          <span className={s.chevron} data-open={expanded}>▼</span>
        </button>

        {/* ══════════ Expanded Dropdown ══════════ */}
        {expanded && (
          <div
            className={`tf-fade-in ${s.dropdown}`}
          >
            {/* ── View Toggle: This Chart / All Positions ── */}
            <div className={s.viewToggle}>
              {['chart', 'all'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={s.viewBtn}
                  data-active={viewMode === mode}
                >
                  {mode === 'chart' ? `📊 This Chart` : `🌐 All Positions`}
                </button>
              ))}
            </div>

            {/* ── Open Positions Section ── */}
            <div className={s.posSection}>
              <div className={s.sectionTitle}>OPEN POSITIONS</div>

              {positionDetails.length === 0 ? (
                <div className={s.emptyMsg}>
                  No open positions{viewMode === 'chart' ? ' on this chart' : ''}
                </div>
              ) : (
                <div className={s.posList}>
                  {positionDetails.map((pos) => {
                    const posColor = pos.pl !== null ? (pos.pl >= 0 ? '#26A69A' : '#EF5350') : C.t3;
                    return (
                      <div key={pos.id} className={s.posCard} style={{ '--pos-color': posColor }}>
                        {/* Row 1: Symbol + Side + P/L */}
                        <div className={s.posRow}>
                          <div className={s.posLeft}>
                            <span className={s.posSymbol}>{pos.symbol}</span>
                            <span className={s.posSide} data-dir={pos.side}>
                              {pos.side === 'long' ? '▲' : '▼'} {pos.side}
                            </span>
                          </div>
                          <div className={s.posRight}>
                            {pos.pl !== null ? (
                              <>
                                <span className={s.posPL}>
                                  {pos.pl >= 0 ? '+' : ''}
                                  {pos.pl.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                <span className={s.posPct}>
                                  ({pos.pctChange >= 0 ? '+' : ''}
                                  {pos.pctChange}%)
                                </span>
                              </>
                            ) : (
                              <span className={s.noPrice}>no price</span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Entry → Current + Duration + Close */}
                        <div className={s.posRow}>
                          <div className={s.posDetail}>
                            {pos.entry.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            {pos.currentPrice && (
                              <>
                                <span className={s.posArrow}>→</span>
                                {pos.currentPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </>
                            )}
                            <span className={s.posDivider}>|</span>
                            <span className={s.posDuration}>⏱ {pos.durationStr}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              closePosition(pos.id);
                            }}
                            title="Close position"
                            className={s.closeBtn}
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
                <div className={s.totalRow}>
                  <span className={s.totalLabel}>TOTAL</span>
                  <span className={s.totalValue}>
                    {totalUnrealized !== null
                      ? `${isPositive ? '+' : ''}${totalUnrealized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </div>
              )}
            </div>

            {/* ── Weekly / Monthly P&L Section ── */}
            <div className={s.perfSection}>
              <div className={s.sectionTitle}>PERFORMANCE</div>
              <div className={s.perfGrid}>
                <PerfStat label="This Week" value={periodStats.week} count={periodStats.weekCount} />
                <PerfStat label="This Month" value={periodStats.month} count={periodStats.monthCount} />
              </div>
            </div>

            {/* ── Close All (only when multiple positions) ── */}
            {positionDetails.length > 1 && (
              <div className={s.closeAllSection}>
                <button
                  onClick={() => {
                    positionDetails.forEach((p) => closePosition(p.id));
                    setExpanded(false);
                  }}
                  className={s.closeAllBtn}
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
    <div className={s.perfStat} style={{ '--perf-color': color }}>
      <div className={s.perfLabel}>{label}</div>
      <div className={s.perfValue}>
        {value >= 0 ? '+' : ''}
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className={s.perfCount}>
        {count} trade{count !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default React.memo(TradePLPill);
