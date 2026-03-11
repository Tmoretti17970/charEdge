// ═══════════════════════════════════════════════════════════════════
// charEdge — ScrubbableInput (Item 23)
//
// DaVinci Resolve-style click-drag numeric input with magnetic snapping.
// Click-drag left/right to decrease/increase value.
// Double-click to enter direct text editing mode.
//
// Props: value, onChange, min, max, step, snap, label, format
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { C } from '../../../constants.js';

const DEFAULT_SNAPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 5, 10, 25, 50, 100];

/**
 * ScrubbableInput — click-drag numeric label with magnetic snapping.
 *
 * @param {number}   value     - Current value
 * @param {Function} onChange  - Callback with new value
 * @param {number}   min       - Minimum value
 * @param {number}   max       - Maximum value
 * @param {number}   step      - Value change per pixel of drag
 * @param {number[]} snap      - Magnetic snap points (defaults to common intervals)
 * @param {string}   label     - Label shown above the value
 * @param {Function} format    - Format function for display
 */
function ScrubbableInput({
    value = 0,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 0.1,
    snap = DEFAULT_SNAPS,
    label = '',
    format = (v) => v.toFixed(2),
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [editValue, setEditValue] = useState('');
    const dragStart = useRef({ x: 0, value: 0 });
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Magnetic snap — find nearest snap point within tolerance
    const snapValue = useCallback(
        (v) => {
            if (!snap?.length) return v;
            const tolerance = step * 2;
            for (const s of snap) {
                const remainder = Math.abs(v % s);
                if (remainder < tolerance || Math.abs(remainder - s) < tolerance) {
                    return Math.round(v / s) * s;
                }
            }
            return v;
        },
        [snap, step]
    );

    // ─── Drag Handlers ─────────────────────────────────────────────
    const handlePointerDown = useCallback(
        (e) => {
            if (isEditing) return;
            e.preventDefault();
            dragStart.current = { x: e.clientX, value };
            setIsDragging(true);
            e.target.setPointerCapture(e.pointerId);
        },
        [value, isEditing]
    );

    const handlePointerMove = useCallback(
        (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStart.current.x;
            const raw = dragStart.current.value + dx * step;
            const snapped = snapValue(raw);
            const clamped = Math.min(max, Math.max(min, snapped));
            onChange?.(clamped);
        },
        [isDragging, step, min, max, onChange, snapValue]
    );

    const handlePointerUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // ─── Double-click Text Edit ────────────────────────────────────
    const handleDoubleClick = useCallback(() => {
        setIsEditing(true);
        setEditValue(String(value));
    }, [value]);

    const handleEditSubmit = useCallback(() => {
        const parsed = parseFloat(editValue);
        if (!isNaN(parsed)) {
            const clamped = Math.min(max, Math.max(min, parsed));
            onChange?.(clamped);
        }
        setIsEditing(false);
    }, [editValue, min, max, onChange]);

    const handleEditKey = useCallback(
        (e) => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') setIsEditing(false);
        },
        [handleEditSubmit]
    );

    // Auto-focus input on edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    return (
        <div
            ref={containerRef}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                userSelect: 'none',
            }}
        >
            {/* Label */}
            {label && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: C.t3,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}
                >
                    {label}
                </span>
            )}

            {/* Value / Input */}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleEditSubmit}
                    onKeyDown={handleEditKey}
                    style={{
                        width: 60,
                        padding: '2px 4px',
                        border: `1px solid ${C.b}`,
                        borderRadius: 4,
                        background: C.sf,
                        color: C.t1,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--tf-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'center',
                        outline: 'none',
                    }}
                />
            ) : (
                <span
                    role="slider"
                    aria-label={label || 'Scrub to adjust'}
                    aria-valuenow={value}
                    aria-valuemin={min === -Infinity ? undefined : min}
                    aria-valuemax={max === Infinity ? undefined : max}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                    style={{
                        cursor: isDragging ? 'ew-resize' : 'ew-resize',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: isDragging ? `${C.b}15` : 'transparent',
                        border: isDragging ? `1px solid ${C.b}30` : '1px solid transparent',
                        color: isDragging ? C.b : C.t1,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'var(--tf-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        transition: isDragging ? 'none' : 'all 0.15s ease',
                        letterSpacing: '-0.01em',
                    }}
                >
                    {format(value)}
                </span>
            )}
        </div>
    );
}

export default memo(ScrubbableInput);
