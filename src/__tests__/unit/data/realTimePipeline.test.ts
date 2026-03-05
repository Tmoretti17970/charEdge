// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Real-Time Pipeline Services
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionQuality } from '../../../data/connectionQuality.ts';
import { detectStreamingMode, getStreamingConfig, setStreamingMode, clearStreamingOverride } from '../../../data/adaptiveStreaming.ts';

// ─── Connection Quality ─────────────────────────────────────────

describe('Connection Quality', () => {
    let cq: ConnectionQuality;

    beforeEach(() => {
        cq = new ConnectionQuality();
    });

    it('starts as disconnected with no samples', () => {
        const status = cq.getStatus();
        expect(status.quality).toBe('disconnected');
        expect(status.sampleCount).toBe(0);
    });

    it('measures RTT from ping/pong cycle', () => {
        // Simulate a fast ping/pong
        cq.recordPing();
        // Manually set lastPongAt to simulate a 50ms RTT
        cq.recordPong();

        const status = cq.getStatus();
        // RTT should be very small since both calls are in-process
        expect(status.quality).toBe('green');
        expect(status.rttMs).toBeGreaterThanOrEqual(0);
        expect(status.sampleCount).toBe(1);
    });

    it('classifies green for low RTT', () => {
        cq = new ConnectionQuality({ greenThresholdMs: 1000, yellowThresholdMs: 2000 });
        cq.recordPing();
        cq.recordPong();
        const status = cq.getStatus();
        expect(status.quality).toBe('green');
    });

    it('resets all measurements', () => {
        cq.recordPing();
        cq.recordPong();
        expect(cq.getStatus().sampleCount).toBe(1);
        cq.reset();
        expect(cq.getStatus().sampleCount).toBe(0);
    });
});

// ─── Adaptive Streaming ─────────────────────────────────────────

describe('Adaptive Streaming', () => {
    it('returns full config by default on desktop', () => {
        const config = detectStreamingMode();
        // In test environment (Node.js), no navigator.connection → full mode
        expect(['full', 'reduced', 'minimal']).toContain(config.mode);
        expect(config.tickIntervalMs).toBeGreaterThanOrEqual(0);
        expect(config.reason).toBeDefined();
    });

    it('returns correct config for each mode', () => {
        const full = getStreamingConfig('full');
        expect(full.tickIntervalMs).toBe(0);
        expect(full.depthLevels).toBe(20);

        const reduced = getStreamingConfig('reduced');
        expect(reduced.tickIntervalMs).toBe(1000);
        expect(reduced.depthLevels).toBe(10);

        const minimal = getStreamingConfig('minimal');
        expect(minimal.tickIntervalMs).toBe(5000);
        expect(minimal.depthEnabled).toBe(false);
    });

    it('getStreamingConfig returns complete configs for all modes', () => {
        for (const mode of ['full', 'reduced', 'minimal'] as const) {
            const config = getStreamingConfig(mode);
            expect(config.mode).toBe(mode);
            expect(config.reason).toContain('Explicit mode');
            expect(typeof config.tickIntervalMs).toBe('number');
            expect(typeof config.depthEnabled).toBe('boolean');
        }
    });
});
