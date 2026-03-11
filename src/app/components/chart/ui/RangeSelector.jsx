// ═══════════════════════════════════════════════════════════════════
// charEdge — Range Selector Buttons
//
// Phase 3 Task 3.3.3: Quick range presets (1D, 5D, 1M, 3M, 6M, 1Y, ALL).
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, F } from '../../../constants.js';

const RANGES = [
    { id: '1D', label: '1D', days: 1 },
    { id: '5D', label: '5D', days: 5 },
    { id: '1M', label: '1M', days: 30 },
    { id: '3M', label: '3M', days: 90 },
    { id: '6M', label: '6M', days: 180 },
    { id: '1Y', label: '1Y', days: 365 },
    { id: 'ALL', label: 'ALL', days: Infinity },
];

/**
 * Range selector buttons for quick time range presets.
 *
 * @param {Object}   props
 * @param {string}   props.activeRange - Currently selected range ID
 * @param {Function} props.onSelect - Callback when range is selected
 */
export default function RangeSelector({ activeRange = 'ALL', onSelect }) {
    const [hovered, setHovered] = useState(null);

    return (
        <div
            role="group"
            aria-label="Date range presets"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '2px 3px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            {RANGES.map((r) => {
                const isActive = activeRange === r.id;
                const isHovered = hovered === r.id;
                return (
                    <button
                        key={r.id}
                        onClick={() => onSelect?.(r.id, r.days)}
                        onMouseEnter={() => setHovered(r.id)}
                        onMouseLeave={() => setHovered(null)}
                        aria-pressed={isActive}
                        style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: isActive
                                ? C.b + '20'
                                : isHovered
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'transparent',
                            color: isActive ? C.b : isHovered ? C.t1 : C.t3,
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: F,
                            letterSpacing: '0.03em',
                            cursor: 'pointer',
                            lineHeight: 1,
                            transition: 'all 0.12s ease',
                            userSelect: 'none',
                        }}
                    >
                        {r.label}
                    </button>
                );
            })}
        </div>
    );
}
