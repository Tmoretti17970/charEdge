// ═══════════════════════════════════════════════════════════════════
// charEdge — Time & Sales Panel
//
// Task 8.3.4: Real-time trade tape consuming TickRingBuffer data.
// TradingView/Bloomberg-style scrolling list with buy/sell color
// coding, auto-scroll, and pause-on-hover.
//
// Usage:
//   <TimeSalesPanel symbol="BTCUSDT" maxRows={200} />
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { webSocketService } from '../../../../data/WebSocketService';
// eslint-disable-next-line import/order
import s from './TimeSalesPanel.module.css';

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Format a timestamp (epoch ms) to HH:MM:SS.mmm
 */
function formatTime(ms) {
    if (!ms || !isFinite(ms)) return '--:--:--';
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms3 = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms3}`;
}

/**
 * Format quantity with K/M suffix for large numbers.
 */
function formatQty(qty) {
    if (qty >= 1_000_000) return (qty / 1_000_000).toFixed(2) + 'M';
    if (qty >= 10_000) return (qty / 1_000).toFixed(1) + 'K';
    if (qty >= 1_000) return (qty / 1_000).toFixed(2) + 'K';
    if (qty >= 1) return qty.toFixed(4);
    return qty.toFixed(6);
}

// Sprint 9 #73: formatPrice consolidated into shared/formatting.ts
// eslint-disable-next-line import/order
import { formatPrice } from '../../../shared/formatting';

// ─── Constants ──────────────────────────────────────────────────

const POLL_MS = 100;     // Refresh rate for reading from ring buffer
const DEFAULT_MAX = 200; // Maximum visible rows

// ─── Component ──────────────────────────────────────────────────

export default function TimeSalesPanel({ symbol, maxRows = DEFAULT_MAX }) {
    const [trades, setTrades] = useState([]);
    const [paused, setPaused] = useState(false);
    const listRef = useRef(null);
    const lastCountRef = useRef(0);

    // ─── Polling Loop (reads from TickRingBuffer) ──────────────

    useEffect(() => {
        if (!symbol) return;

        const interval = setInterval(() => {
            if (paused) return;

            const buf = webSocketService.getTickBuffer(symbol);
            if (!buf || buf.isEmpty()) return;

            const count = buf.length();
            // Only update if new ticks have arrived
            if (count === lastCountRef.current) return;
            lastCountRef.current = count;

            const n = Math.min(count, maxRows);
            const slice = buf.peekLast(n);

            // Convert SoA arrays to row objects (newest first)
            const rows = [];
            for (let i = slice.length - 1; i >= 0; i--) {
                rows.push({
                    time: slice.time[i],
                    price: slice.price[i],
                    qty: slice.qty[i],
                    side: slice.side[i], // 0 = buy, 1 = sell
                });
            }
            setTrades(rows);
        }, POLL_MS);

        return () => clearInterval(interval);
    }, [symbol, maxRows, paused]);

    // ─── Auto-scroll to top (newest trades) ────────────────────

    useEffect(() => {
        if (!paused && listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [trades, paused]);

    // ─── Pause on hover ────────────────────────────────────────

    const handleMouseEnter = useCallback(() => setPaused(true), []);
    const handleMouseLeave = useCallback(() => setPaused(false), []);

    // ─── Buy/Sell Stats ────────────────────────────────────────

    const stats = useMemo(() => {
        let buys = 0, sells = 0;
        for (const t of trades) {
            if (t.side === 0) buys++;
            else sells++;
        }
        return { buys, sells };
    }, [trades]);

    // ─── Render ────────────────────────────────────────────────

    return (
        <div className={s.container}>
            {/* Header */}
            <div className={s.header}>
                <span className={s.title}>Time & Sales</span>
                <div className={s.stats}>
                    <span className={s.statBuy}>B:{stats.buys}</span>
                    <span className={s.statSell}>S:{stats.sells}</span>
                </div>
            </div>

            {/* Column Headers */}
            <div className={s.colHeaders}>
                <span>Time</span>
                <span>Price</span>
                <span className={s.colRight}>Size</span>
                <span className={s.colRight}>Side</span>
            </div>

            {/* Trade List */}
            {trades.length === 0 ? (
                <div className={s.empty}>Waiting for trades…</div>
            ) : (
                <div
                    ref={listRef}
                    className={s.tradeList}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {trades.map((t, i) => (
                        <div
                            key={`${t.time}-${t.price}-${i}`}
                            className={`${s.row} ${i === 0 && !paused ? s.rowNew : ''}`}
                        >
                            <span className={s.cell}>{formatTime(t.time)}</span>
                            <span className={t.side === 0 ? s.priceBuy : s.priceSell}>
                                {formatPrice(t.price)}
                            </span>
                            <span className={s.cellRight}>{formatQty(t.qty)}</span>
                            <span className={s.cellRight}>
                                <span className={t.side === 0 ? s.sideBuy : s.sideSell}>
                                    {t.side === 0 ? 'BUY' : 'SELL'}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Paused Banner */}
            {paused && (
                <div className={s.pausedBanner} onClick={() => setPaused(false)}>
                    ⏸ Paused — click to resume
                </div>
            )}
        </div>
    );
}
