// ═══════════════════════════════════════════════════════════════════
// charEdge — WebSocket Connection Quality Indicator
//
// Measures RTT from WebSocket heartbeat ping/pong cycles and
// classifies connection quality as green/yellow/red.
//
// Usage:
//   const quality = new ConnectionQuality();
//   quality.recordPing();   // when sending ping
//   quality.recordPong();   // when receiving pong
//   quality.getStatus();    // → { quality: 'green', rttMs: 42, ... }
// ═══════════════════════════════════════════════════════════════════

export type QualityLevel = 'green' | 'yellow' | 'red' | 'disconnected';

export interface QualityStatus {
    quality: QualityLevel;
    rttMs: number;
    avgRttMs: number;
    jitterMs: number;
    sampleCount: number;
    lastPingAt: number;
}

interface QualityConfig {
    /** RTT threshold for green (default: 100ms) */
    greenThresholdMs: number;
    /** RTT threshold for yellow (default: 500ms) */
    yellowThresholdMs: number;
    /** Max RTT samples to keep for averaging (default: 20) */
    maxSamples: number;
    /** Max time without pong before considering disconnected (default: 10s) */
    disconnectedThresholdMs: number;
}

const DEFAULT_CONFIG: QualityConfig = {
    greenThresholdMs: 100,
    yellowThresholdMs: 500,
    maxSamples: 20,
    disconnectedThresholdMs: 10_000,
};

export class ConnectionQuality {
    private config: QualityConfig;
    private rttSamples: number[] = [];
    private lastPingAt = 0;
    private lastPongAt = 0;
    private lastRtt = 0;

    constructor(config: Partial<QualityConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Call when sending a ping to the WebSocket server */
    recordPing(): void {
        this.lastPingAt = performance.now();
    }

    /** Call when receiving a pong from the WebSocket server */
    recordPong(): void {
        this.lastPongAt = performance.now();

        if (this.lastPingAt > 0) {
            this.lastRtt = this.lastPongAt - this.lastPingAt;

            this.rttSamples.push(this.lastRtt);
            if (this.rttSamples.length > this.config.maxSamples) {
                this.rttSamples.shift();
            }
        }
    }

    /** Get current connection quality status */
    getStatus(): QualityStatus {
        const now = performance.now();
        const timeSinceLastPong = this.lastPongAt > 0 ? now - this.lastPongAt : Infinity;

        // Disconnected if no pong received recently
        if (timeSinceLastPong > this.config.disconnectedThresholdMs) {
            return {
                quality: 'disconnected',
                rttMs: 0,
                avgRttMs: 0,
                jitterMs: 0,
                sampleCount: this.rttSamples.length,
                lastPingAt: this.lastPingAt,
            };
        }

        const avgRtt = this.rttSamples.length > 0
            ? this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length
            : 0;

        // Jitter = standard deviation of RTT samples
        let jitter = 0;
        if (this.rttSamples.length >= 2) {
            const variance = this.rttSamples.reduce(
                (sum, rtt) => sum + (rtt - avgRtt) ** 2, 0,
            ) / (this.rttSamples.length - 1);
            jitter = Math.sqrt(variance);
        }

        let quality: QualityLevel;
        if (avgRtt <= this.config.greenThresholdMs) {
            quality = 'green';
        } else if (avgRtt <= this.config.yellowThresholdMs) {
            quality = 'yellow';
        } else {
            quality = 'red';
        }

        return {
            quality,
            rttMs: Math.round(this.lastRtt * 100) / 100,
            avgRttMs: Math.round(avgRtt * 100) / 100,
            jitterMs: Math.round(jitter * 100) / 100,
            sampleCount: this.rttSamples.length,
            lastPingAt: this.lastPingAt,
        };
    }

    /** Reset all measurements */
    reset(): void {
        this.rttSamples = [];
        this.lastPingAt = 0;
        this.lastPongAt = 0;
        this.lastRtt = 0;
    }
}

export const connectionQuality = new ConnectionQuality();
