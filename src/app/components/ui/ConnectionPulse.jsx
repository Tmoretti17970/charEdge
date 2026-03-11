// ═══════════════════════════════════════════════════════════════════
// charEdge — ConnectionPulse (Unified Status Indicator)
//
// Item 12: Replaces fragmented FreshnessBadge + OfflineBadge + inline
// status dots with a single always-visible connection state component.
//
// States: Live (green pulse) | Syncing (amber spin) | Stale (grey) | Error (red)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { C } from '../../../constants.js';

const STATES = {
    live: { label: 'Live', color: C.g, icon: '●', pulse: true },
    syncing: { label: 'Syncing', color: C.y, icon: '↻', pulse: false },
    stale: { label: 'Stale', color: C.t3, icon: '○', pulse: false },
    error: { label: 'Error', color: C.r, icon: '✕', pulse: false },
};

/**
 * ConnectionPulse — unified always-visible connection health indicator.
 *
 * @param {'live'|'syncing'|'stale'|'error'} status - Current connection state
 * @param {number} latencyMs - Optional latency in milliseconds
 * @param {boolean} compact - Compact mode (dot-only, no label)
 */
export default function ConnectionPulse({ status = 'live', latencyMs = null, compact = false }) {
    const s = STATES[status] || STATES.stale;
    const [flash, setFlash] = useState(false);
    const prevStatus = useRef(status);

    // Flash animation on status change
    useEffect(() => {
        if (prevStatus.current !== status) {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 600);
            prevStatus.current = status;
            return () => clearTimeout(t);
        }
    }, [status]);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={`Connection: ${s.label}${latencyMs != null ? `, ${latencyMs}ms` : ''}`}
            title={`${s.label}${latencyMs != null ? ` · ${latencyMs}ms` : ''}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: compact ? 0 : 6,
                padding: compact ? '2px 4px' : '3px 8px',
                borderRadius: 20,
                background: `${s.color}10`,
                border: `1px solid ${s.color}20`,
                cursor: 'default',
                transition: 'all 0.3s ease',
                transform: flash ? 'scale(1.08)' : 'scale(1)',
                fontFamily: "'Inter', sans-serif",
            }}
        >
            {/* Animated dot */}
            <span
                style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: s.color,
                    boxShadow: s.pulse ? `0 0 0 0 ${s.color}` : 'none',
                    animation: s.pulse ? 'tfConnectionPulse 2s ease-in-out infinite' : 'none',
                    flexShrink: 0,
                }}
            />

            {/* Label (hidden in compact mode) */}
            {!compact && (
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: s.color,
                        letterSpacing: '0.03em',
                    }}
                >
                    {s.label}
                </span>
            )}

            {/* Latency badge */}
            {latencyMs != null && !compact && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 500,
                        color: C.t3,
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'var(--tf-mono)',
                    }}
                >
                    {latencyMs}ms
                </span>
            )}
        </div>
    );
}
