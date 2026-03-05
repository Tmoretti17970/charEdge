// ═══════════════════════════════════════════════════════════════════
// charEdge — Connection Status Indicator
//
// Phase 2 Task 2.2.5: Data staleness UI indicator.
// Shows LIVE / STALE / DISCONNECTED badge in the chart header.
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../../constants.js';

type ConnectionState = 'live' | 'stale' | 'disconnected' | 'error';

interface StateConfig {
    label: string;
    color: string;
    bg: string;
    border: string;
    pulse: boolean;
}

const STATE_CONFIG: Record<ConnectionState, StateConfig> = {
    live: {
        label: 'LIVE',
        color: C.g,
        bg: `${C.g}18`,
        border: `${C.g}30`,
        pulse: true,
    },
    stale: {
        label: 'STALE',
        color: C.y,
        bg: `${C.y}18`,
        border: `${C.y}30`,
        pulse: false,
    },
    disconnected: {
        label: 'DISCONNECTED',
        color: C.r,
        bg: `${C.r}18`,
        border: `${C.r}30`,
        pulse: false,
    },
    error: {
        label: 'ERROR',
        color: C.r,
        bg: `${C.r}18`,
        border: `${C.r}30`,
        pulse: false,
    },
};

interface ConnectionStatusProps {
    state?: ConnectionState;
    latencyMs?: number;
    detail?: string;
}

export default function ConnectionStatus({
    state = 'live',
    latencyMs,
    detail,
}: ConnectionStatusProps) {
    const config = STATE_CONFIG[state] ?? STATE_CONFIG.disconnected;

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={`Connection status: ${config.label}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px 3px 8px',
                borderRadius: 100,
                background: config.bg,
                border: `1px solid ${config.border}`,
                fontSize: 10,
                fontFamily: F,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: config.color,
                lineHeight: 1,
                userSelect: 'none',
                flexShrink: 0,
            }}
            title={detail ?? `${config.label}${latencyMs != null ? ` · ${latencyMs}ms` : ''}`}
        >
            {/* Dot indicator */}
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: config.color,
                    flexShrink: 0,
                    ...(config.pulse
                        ? {
                            animation: 'ce-pulse 2s ease-in-out infinite',
                            boxShadow: `0 0 6px ${config.color}60`,
                        }
                        : {}),
                }}
            />
            <span>{config.label}</span>
            {latencyMs != null && (
                <span style={{ opacity: 0.6, fontWeight: 500 }}>{latencyMs}ms</span>
            )}
        </div>
    );
}

export type { ConnectionState, ConnectionStatusProps };
