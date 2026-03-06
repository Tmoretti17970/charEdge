// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Keyboard Navigation (Batch 16: 4.6.2)
//
// Keyboard-accessible chart interaction overlay. Provides:
//   - Arrow keys: move crosshair between candles
//   - Tab: cycle through drawings/indicators
//   - Enter/Space: select focused element
//   - Escape: deselect
//   - ARIA live region for screen reader announcements
//
// Mount inside ChartEngineWidget as a child component.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, F } from '../../../constants.js';

/**
 * Chart keyboard navigation controller.
 * Manages keyboard focus, ARIA announcements, and element cycling.
 *
 * Props:
 *   chartRef     — React ref to the chart canvas or container
 *   bars         — array of bar data (for crosshair navigation)
 *   drawings     — array of drawing objects on canvas
 *   onCrosshairMove — callback(barIndex) when crosshair moves
 *   onSelectDrawing — callback(drawingId) when a drawing is selected
 *   onDeselect    — callback when selection is cleared
 */
export default function ChartKeyboardNav({
    chartRef,
    bars = [],
    drawings = [],
    onCrosshairMove,
    onSelectDrawing,
    onDeselect,
}) {
    const [focusedBarIndex, setFocusedBarIndex] = useState(-1);
    const [focusedDrawingIndex, setFocusedDrawingIndex] = useState(-1);
    const [mode, setMode] = useState('crosshair'); // 'crosshair' | 'drawings'
    const announcementRef = useRef(null);

    // ─── Screen reader announcement ──────────────────────────────

    const announce = useCallback((message) => {
        if (announcementRef.current) {
            announcementRef.current.textContent = '';
            // Force re-announcement by clearing then setting
            requestAnimationFrame(() => {
                if (announcementRef.current) {
                    announcementRef.current.textContent = message;
                }
            });
        }
    }, []);

    // ─── Bar announcement ────────────────────────────────────────

    const announceBar = useCallback(
        (index) => {
            if (index < 0 || index >= bars.length) return;
            const bar = bars[index];
            if (!bar) return;

            const date = bar.time
                ? new Date(typeof bar.time === 'number' ? bar.time * 1000 : bar.time).toLocaleDateString()
                : '';

            const msg = [
                date,
                `Open: ${bar.open?.toFixed(2) ?? '—'}`,
                `High: ${bar.high?.toFixed(2) ?? '—'}`,
                `Low: ${bar.low?.toFixed(2) ?? '—'}`,
                `Close: ${bar.close?.toFixed(2) ?? '—'}`,
                bar.volume ? `Volume: ${bar.volume.toLocaleString()}` : '',
            ]
                .filter(Boolean)
                .join(', ');

            announce(msg);
        },
        [bars, announce],
    );

    // ─── Keyboard handler ────────────────────────────────────────

    const handleKeyDown = useCallback(
        (e) => {
            // Only handle when chart is focused
            const chartEl = chartRef?.current;
            if (!chartEl || !chartEl.contains(document.activeElement)) return;

            switch (e.key) {
                case 'ArrowRight': {
                    e.preventDefault();
                    const next = Math.min(focusedBarIndex + 1, bars.length - 1);
                    setFocusedBarIndex(next);
                    onCrosshairMove?.(next);
                    announceBar(next);
                    break;
                }

                case 'ArrowLeft': {
                    e.preventDefault();
                    const prev = Math.max(focusedBarIndex - 1, 0);
                    setFocusedBarIndex(prev);
                    onCrosshairMove?.(prev);
                    announceBar(prev);
                    break;
                }

                case 'ArrowUp': {
                    e.preventDefault();
                    // Jump 10 bars forward
                    const jump = Math.min(focusedBarIndex + 10, bars.length - 1);
                    setFocusedBarIndex(jump);
                    onCrosshairMove?.(jump);
                    announceBar(jump);
                    break;
                }

                case 'ArrowDown': {
                    e.preventDefault();
                    // Jump 10 bars back
                    const jumpBack = Math.max(focusedBarIndex - 10, 0);
                    setFocusedBarIndex(jumpBack);
                    onCrosshairMove?.(jumpBack);
                    announceBar(jumpBack);
                    break;
                }

                case 'Tab': {
                    e.preventDefault();
                    if (mode === 'crosshair' && drawings.length > 0) {
                        // Switch to drawing mode
                        setMode('drawings');
                        setFocusedDrawingIndex(0);
                        announce(`Drawing mode. ${drawings[0]?.type || 'Drawing'} 1 of ${drawings.length}`);
                    } else if (mode === 'drawings') {
                        const next = (focusedDrawingIndex + 1) % (drawings.length + 1);
                        if (next >= drawings.length) {
                            // Cycle back to crosshair mode
                            setMode('crosshair');
                            setFocusedDrawingIndex(-1);
                            announce('Crosshair mode');
                        } else {
                            setFocusedDrawingIndex(next);
                            announce(`${drawings[next]?.type || 'Drawing'} ${next + 1} of ${drawings.length}`);
                        }
                    }
                    break;
                }

                case 'Enter':
                case ' ': {
                    e.preventDefault();
                    if (mode === 'drawings' && focusedDrawingIndex >= 0) {
                        const drawing = drawings[focusedDrawingIndex];
                        if (drawing) {
                            onSelectDrawing?.(drawing.id || drawing);
                            announce(`Selected: ${drawing.type || 'Drawing'}`);
                        }
                    }
                    break;
                }

                case 'Escape': {
                    e.preventDefault();
                    setMode('crosshair');
                    setFocusedDrawingIndex(-1);
                    setFocusedBarIndex(-1);
                    onDeselect?.();
                    announce('Deselected. Crosshair mode.');
                    break;
                }

                case 'Home': {
                    e.preventDefault();
                    setFocusedBarIndex(0);
                    onCrosshairMove?.(0);
                    announceBar(0);
                    break;
                }

                case 'End': {
                    e.preventDefault();
                    const last = bars.length - 1;
                    setFocusedBarIndex(last);
                    onCrosshairMove?.(last);
                    announceBar(last);
                    break;
                }

                default:
                    break;
            }
        },
        [
            chartRef, focusedBarIndex, focusedDrawingIndex, mode,
            bars, drawings, onCrosshairMove, onSelectDrawing, onDeselect,
            announce, announceBar,
        ],
    );

    // ─── Attach/detach keyboard listener ─────────────────────────

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // ─── Render ──────────────────────────────────────────────────

    return (
        <>
            {/* ARIA live region for screen reader announcements */}
            <div
                ref={announcementRef}
                role="status"
                aria-live="assertive"
                aria-atomic="true"
                style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                }}
            />

            {/* Visual focus indicator (visible only when using keyboard) */}
            {focusedBarIndex >= 0 && mode === 'crosshair' && (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${C.sf}ee`,
                        color: C.t2,
                        fontSize: 10,
                        fontFamily: F,
                        pointerEvents: 'none',
                        zIndex: 100,
                    }}
                >
                    ⌨ Bar {focusedBarIndex + 1}/{bars.length}
                    {mode === 'drawings' && ` | Drawing ${focusedDrawingIndex + 1}/${drawings.length}`}
                </div>
            )}
        </>
    );
}
