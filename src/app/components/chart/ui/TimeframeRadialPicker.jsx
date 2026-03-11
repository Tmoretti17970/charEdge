// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeframeRadialPicker (Item 21)
//
// Radial/pie menu for fast timeframe selection.
// Mobile: long-press on active TF pill → radial picker opens
// Desktop: right-click context menu or Ctrl+T shortcut
//
// Positions 8 common timeframes around a radial arc with transform-origin
// animations. Drag-to-select on mobile for single-gesture TF switching.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, memo } from 'react';
import { C, GLASS, M } from '../../../../constants.js';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];
const RADIUS = 70; // px from center

/**
 * TimeframeRadialPicker — radial pie menu for fast timeframe selection.
 *
 * @param {boolean} isOpen - Whether the picker is visible
 * @param {{ x: number, y: number }} position - Center position (screen coords)
 * @param {string} activeTf - Currently active timeframe
 * @param {(tf: string) => void} onSelect - Callback when a timeframe is selected
 * @param {() => void} onClose - Callback to close the picker
 */
function TimeframeRadialPicker({ isOpen, position, activeTf, onSelect, onClose }) {
    const [hoveredIndex, setHoveredIndex] = useState(-1);
    const overlayRef = useRef(null);

    // Close on escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (overlayRef.current && !overlayRef.current.contains(e.target)) {
                onClose?.();
            }
        };
        // Defer to prevent immediate close on same click
        const t = setTimeout(() => document.addEventListener('pointerdown', handleClick), 50);
        return () => {
            clearTimeout(t);
            document.removeEventListener('pointerdown', handleClick);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const cx = position?.x || 0;
    const cy = position?.y || 0;

    return (
        <div
            ref={overlayRef}
            role="menu"
            aria-label="Timeframe selector"
            style={{
                position: 'fixed',
                left: cx - RADIUS - 28,
                top: cy - RADIUS - 28,
                width: (RADIUS + 28) * 2,
                height: (RADIUS + 28) * 2,
                zIndex: 'var(--tf-z-popover, 1000)',
                pointerEvents: 'auto',
                animation: 'tfRadialIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
        >
            {/* Center indicator */}
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: GLASS.standard,
                    backdropFilter: GLASS.blurMd,
                    border: `1px solid ${C.bd}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.t3,
                    fontFamily: M,
                }}
            >
                TF
            </div>

            {/* Timeframe items arranged radially */}
            {TIMEFRAMES.map((tf, i) => {
                const angle = (i / TIMEFRAMES.length) * Math.PI * 2 - Math.PI / 2; // Start from top
                const x = Math.cos(angle) * RADIUS;
                const y = Math.sin(angle) * RADIUS;
                const isActive = tf === activeTf;
                const isHovered = i === hoveredIndex;

                return (
                    <button
                        key={tf}
                        role="menuitem"
                        aria-current={isActive ? 'true' : undefined}
                        onPointerEnter={() => setHoveredIndex(i)}
                        onPointerLeave={() => setHoveredIndex(-1)}
                        onClick={() => {
                            onSelect?.(tf);
                            onClose?.();
                        }}
                        style={{
                            position: 'absolute',
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: `translate(-50%, -50%) scale(${isHovered ? 1.15 : 1})`,
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            border: isActive ? `2px solid ${C.b}` : `1px solid ${C.bd}40`,
                            background: isActive
                                ? `${C.b}18`
                                : isHovered
                                    ? GLASS.standard
                                    : GLASS.subtle,
                            backdropFilter: GLASS.blurSm,
                            color: isActive ? C.b : isHovered ? C.t1 : C.t2,
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: M,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            // Staggered entrance animation
                            animationDelay: `${i * 25}ms`,
                            animation: 'tfRadialItemIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
                        }}
                    >
                        {tf}
                    </button>
                );
            })}
        </div>
    );
}

export default memo(TimeframeRadialPicker);
