// ═══════════════════════════════════════════════════════════════════
// charEdge — Adaptive Streaming Service
//
// Automatically adjusts data streaming quality based on:
//   - Network speed (navigator.connection API)
//   - Device type (mobile vs desktop)
//   - Explicit user preference
//
// Modes:
//   'full'    — Every tick, full depth, all indicators (desktop)
//   'reduced' — 1s OHLC snapshots, reduced depth (mobile/slow)
//   'minimal' — 5s snapshots, no depth (very slow / battery saver)
// ═══════════════════════════════════════════════════════════════════

export type StreamingMode = 'full' | 'reduced' | 'minimal';

export interface StreamingConfig {
    mode: StreamingMode;
    tickIntervalMs: number;
    depthEnabled: boolean;
    depthLevels: number;
    reason: string;
}

interface NetworkInfo {
    effectiveType?: string;    // 'slow-2g' | '2g' | '3g' | '4g'
    downlink?: number;         // Mbps
    saveData?: boolean;        // User enabled data saver
}

const CONFIGS: Record<StreamingMode, Omit<StreamingConfig, 'reason'>> = {
    full: {
        mode: 'full',
        tickIntervalMs: 0,       // Every tick
        depthEnabled: true,
        depthLevels: 20,
    },
    reduced: {
        mode: 'reduced',
        tickIntervalMs: 1000,    // 1s OHLC snapshots
        depthEnabled: true,
        depthLevels: 10,
    },
    minimal: {
        mode: 'minimal',
        tickIntervalMs: 5000,    // 5s snapshots
        depthEnabled: false,
        depthLevels: 0,
    },
};

/**
 * Detect the optimal streaming mode based on network conditions.
 */
export function detectStreamingMode(): StreamingConfig {
    // 1. Check user override
    if (typeof localStorage !== 'undefined') {
        const override = localStorage.getItem('charEdge_streamingMode') as StreamingMode | null;
        if (override && CONFIGS[override]) {
            return { ...CONFIGS[override], reason: `User preference: ${override}` };
        }
    }

    // 2. Check Network Information API
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const connection = (nav as unknown as { connection?: NetworkInfo })?.connection;

    if (connection) {
        // Data saver mode
        if (connection.saveData) {
            return { ...CONFIGS.minimal, reason: 'Data saver enabled' };
        }

        // Slow connections
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            return { ...CONFIGS.minimal, reason: `Slow connection: ${connection.effectiveType}` };
        }

        if (connection.effectiveType === '3g') {
            return { ...CONFIGS.reduced, reason: '3G connection detected' };
        }

        // Low bandwidth
        if (connection.downlink !== undefined && connection.downlink < 1) {
            return { ...CONFIGS.reduced, reason: `Low bandwidth: ${connection.downlink}Mbps` };
        }
    }

    // 3. Check if mobile device
    if (nav && /Mobi|Android|iPhone|iPad/i.test(nav.userAgent)) {
        return { ...CONFIGS.reduced, reason: 'Mobile device detected' };
    }

    // 4. Default: full streaming
    return { ...CONFIGS.full, reason: 'Desktop with good connection' };
}

/**
 * Set a user override for streaming mode.
 */
export function setStreamingMode(mode: StreamingMode): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('charEdge_streamingMode', mode);
    }
}

/**
 * Clear user override, reverting to auto-detection.
 */
export function clearStreamingOverride(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('charEdge_streamingMode');
    }
}

/**
 * Get the config for a specific mode.
 */
export function getStreamingConfig(mode: StreamingMode): StreamingConfig {
    return { ...CONFIGS[mode], reason: `Explicit mode: ${mode}` };
}
