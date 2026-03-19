// ═══════════════════════════════════════════════════════════════════
// charEdge — Timeframe Swipe Strip (Strategic Item #22)
//
// Horizontally swipeable timeframe selector for touch and mouse.
// Uses scroll-snap for crisp auto-centering. Arrow key navigation.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import { C, M } from '@/constants.js';
import { radii } from '../../../../theme/tokens.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';

const TIMEFRAMES = [
    { value: '1m', display: '1m' },
    { value: '5m', display: '5m' },
    { value: '15m', display: '15m' },
    { value: '1h', display: '1H' },
    { value: '4h', display: '4H' },
    { value: '1D', display: '1D' },
    { value: '1W', display: '1W' },
    { value: '1M', display: '1M' },
];

function TimeframeSwipeStrip() {
    const tf = useChartCoreStore((s) => s.tf);
    const setTf = useChartCoreStore((s) => s.setTf);
    const scrollRef = useRef(null);

    // Scroll active item into view on mount & tf change
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const active = el.querySelector('[data-active="true"]');
        if (active) {
            active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [tf]);

    const handleSelect = useCallback((value) => {
        setTf(value);
    }, [setTf]);

    // Arrow key navigation
    const handleKeyDown = useCallback((e) => {
        const idx = TIMEFRAMES.findIndex((t) => t.value === tf);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = TIMEFRAMES[Math.min(idx + 1, TIMEFRAMES.length - 1)];
            setTf(next.value);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = TIMEFRAMES[Math.max(idx - 1, 0)];
            setTf(prev.value);
        }
    }, [tf, setTf]);

    return (
        <div
            ref={scrollRef}
            role="tablist"
            aria-label="Timeframe selector"
            onKeyDown={handleKeyDown}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: '4px 8px',
                // Hide scrollbar
            }}
        >
            {TIMEFRAMES.map((item) => {
                const isActive = tf === item.value;
                return (
                    <button
                        key={item.value}
                        role="tab"
                        aria-selected={isActive}
                        data-active={isActive}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => handleSelect(item.value)}
                        style={{
                            scrollSnapAlign: 'center',
                            flexShrink: 0,
                            padding: '5px 10px',
                            borderRadius: radii.xs,
                            border: 'none',
                            background: isActive ? C.b : 'transparent',
                            color: isActive ? '#fff' : C.t3,
                            fontSize: 11,
                            fontWeight: isActive ? 800 : 600,
                            fontFamily: M,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            minWidth: 32,
                            textAlign: 'center',
                            letterSpacing: '0.02em',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {item.display}
                    </button>
                );
            })}
        </div>
    );
}

export default React.memo(TimeframeSwipeStrip);
