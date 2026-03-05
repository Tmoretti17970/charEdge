// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Data Table (Screen Reader Alternative)
//
// Phase 4 Task 4.3.6: Provides a visually hidden table of OHLCV
// data that screen readers can navigate. Togglable via button.
//
// Usage:
//   <ChartDataTable bars={bars} visible={showTable} />
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, memo } from 'react';

/**
 * Format timestamp to readable date string.
 */
function formatTimestamp(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Format number with appropriate precision.
 */
function formatPrice(val) {
    if (val == null || isNaN(val)) return '—';
    return val >= 1 ? val.toFixed(2) : val.toFixed(6);
}

function formatVolume(val) {
    if (val == null || isNaN(val)) return '—';
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toFixed(0);
}

/**
 * ChartDataTable — accessible alternative to the visual chart.
 * Shows OHLCV data in a standard HTML table.
 *
 * @param {Object}  props
 * @param {Array}   props.bars - Array of { time, open, high, low, close, volume }
 * @param {boolean} props.visible - Whether to show the table visually
 * @param {string}  [props.symbol] - Symbol name for aria-label
 * @param {number}  [props.maxRows=100] - Maximum rows to display
 */
const ChartDataTable = memo(function ChartDataTable({
    bars = [],
    visible = false,
    symbol = '',
    maxRows = 100,
}) {
    // Take last N bars (most recent first)
    const displayBars = useMemo(() => {
        const slice = bars.slice(-maxRows).reverse();
        return slice;
    }, [bars, maxRows]);

    const srOnlyStyle = visible ? {} : {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
    };

    const visibleStyle = visible ? {
        maxHeight: 400,
        overflow: 'auto',
        marginTop: 8,
        borderRadius: 'var(--br-md, 8px)',
        border: '1px solid var(--c-border, #2a2e3a)',
        background: 'var(--c-bg-secondary, #0e1013)',
    } : {};

    return (
        <div
            role="region"
            aria-label={`${symbol} price data table`}
            style={{ ...srOnlyStyle, ...visibleStyle }}
        >
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--fs-xs, 11px)',
                    fontFamily: 'var(--tf-font, Inter, sans-serif)',
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                <caption style={visible ? { padding: 8, fontWeight: 600 } : srOnlyStyle}>
                    {symbol} OHLCV Data — {displayBars.length} bars
                </caption>
                <thead>
                    <tr style={{
                        borderBottom: '1px solid var(--c-border, #2a2e3a)',
                        color: 'var(--c-fg-secondary, #8b8fa2)',
                    }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Open</th>
                        <th style={thStyle}>High</th>
                        <th style={thStyle}>Low</th>
                        <th style={thStyle}>Close</th>
                        <th style={thStyle}>Volume</th>
                        <th style={thStyle}>Change</th>
                    </tr>
                </thead>
                <tbody>
                    {displayBars.map((bar, i) => {
                        const change = bar.close && bar.open
                            ? ((bar.close - bar.open) / bar.open * 100).toFixed(2)
                            : '0.00';
                        const isUp = bar.close >= bar.open;
                        return (
                            <tr
                                key={bar.time || i}
                                style={{
                                    borderBottom: '1px solid var(--c-border, rgba(42, 46, 58, 0.5))',
                                    color: 'var(--c-fg-primary, #ececef)',
                                }}
                            >
                                <td style={tdStyle}>{formatTimestamp(bar.time)}</td>
                                <td style={tdStyle}>{formatPrice(bar.open)}</td>
                                <td style={tdStyle}>{formatPrice(bar.high)}</td>
                                <td style={tdStyle}>{formatPrice(bar.low)}</td>
                                <td style={tdStyle}>{formatPrice(bar.close)}</td>
                                <td style={tdStyle}>{formatVolume(bar.volume)}</td>
                                <td style={{
                                    ...tdStyle,
                                    color: isUp ? 'var(--c-accent-green, #26A69A)' : 'var(--c-accent-red, #EF5350)',
                                }}>
                                    {isUp ? '+' : ''}{change}%
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
});

const thStyle = {
    padding: '6px 8px',
    textAlign: 'right',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

const tdStyle = {
    padding: '4px 8px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
};

export default ChartDataTable;
