// ═══════════════════════════════════════════════════════════════════
// Unit Tests — Trading Analytics Services
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { detectTilt } from '@/psychology/tiltDetector.ts';
import { generateSessionRecaps, generateLatestRecap } from '@/journal/sessionRecap.ts';
import { kellySize, fixedFractionalSize, atrSize } from '@/trading/positionSizing.ts';

// ─── Tilt Detection ─────────────────────────────────────────────

describe('Tilt Detector', () => {
    it('returns none for winning streak', () => {
        const trades = [
            { pnl: 100, size: 1, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T10:00:00Z' },
            { pnl: 200, size: 1, entryDate: '2024-01-15T11:00:00Z', exitDate: '2024-01-15T12:00:00Z' },
            { pnl: 50, size: 1, entryDate: '2024-01-15T13:00:00Z', exitDate: '2024-01-15T14:00:00Z' },
        ];
        const signal = detectTilt(trades);
        expect(signal.severity).toBe('none');
        expect(signal.consecutiveLosses).toBe(0);
    });

    it('detects 3 consecutive losses as warning', () => {
        const trades = [
            { pnl: 100, size: 1, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T10:00:00Z' },
            { pnl: -50, size: 1, entryDate: '2024-01-15T11:00:00Z', exitDate: '2024-01-15T12:00:00Z' },
            { pnl: -80, size: 1, entryDate: '2024-01-15T13:00:00Z', exitDate: '2024-01-15T14:00:00Z' },
            { pnl: -30, size: 1, entryDate: '2024-01-15T15:00:00Z', exitDate: '2024-01-15T16:00:00Z' },
        ];
        const signal = detectTilt(trades);
        expect(signal.severity).toBe('warning');
        expect(signal.consecutiveLosses).toBe(3);
        expect(signal.suggestedBreakMinutes).toBe(15);
    });

    it('detects size increase after losses as critical', () => {
        const trades = [
            { pnl: -50, size: 1, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T10:00:00Z' },
            { pnl: -80, size: 1, entryDate: '2024-01-15T11:00:00Z', exitDate: '2024-01-15T12:00:00Z' },
            { pnl: -30, size: 1, entryDate: '2024-01-15T13:00:00Z', exitDate: '2024-01-15T14:00:00Z' },
            { pnl: -100, size: 3, entryDate: '2024-01-15T15:00:00Z', exitDate: '2024-01-15T16:00:00Z' },
        ];
        const signal = detectTilt(trades);
        expect(signal.severity).toBe('critical');
        expect(signal.sizeIncreased).toBe(true);
    });

    it('handles empty/short trade arrays', () => {
        expect(detectTilt([]).severity).toBe('none');
        expect(detectTilt([{ pnl: -50, size: 1, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T10:00:00Z' }]).severity).toBe('none');
    });
});

// ─── Session Recaps ─────────────────────────────────────────────

describe('Session Recap', () => {
    const trades = [
        { pnl: 100, size: 1, entryDate: '2024-01-15T09:00:00Z', exitDate: '2024-01-15T10:00:00Z', symbol: 'BTCUSDT' },
        { pnl: -50, size: 1, entryDate: '2024-01-15T10:30:00Z', exitDate: '2024-01-15T11:00:00Z', symbol: 'BTCUSDT' },
        { pnl: 200, size: 2, entryDate: '2024-01-15T11:30:00Z', exitDate: '2024-01-15T12:00:00Z', symbol: 'ETHUSDT' },
        // 6h gap → new session
        { pnl: -100, size: 1, entryDate: '2024-01-15T18:00:00Z', exitDate: '2024-01-15T19:00:00Z', symbol: 'BTCUSDT' },
    ];

    it('splits trades into sessions by inactivity gap', () => {
        const recaps = generateSessionRecaps(trades);
        expect(recaps).toHaveLength(2);
        expect(recaps[0]!.tradeCount).toBe(3);
        expect(recaps[1]!.tradeCount).toBe(1);
    });

    it('computes correct stats for session', () => {
        const recaps = generateSessionRecaps(trades);
        const s1 = recaps[0]!;
        expect(s1.wins).toBe(2);
        expect(s1.losses).toBe(1);
        expect(s1.netPnl).toBe(250);
        expect(s1.winRate).toBe(67);
        expect(s1.symbols).toContain('BTCUSDT');
        expect(s1.symbols).toContain('ETHUSDT');
    });

    it('generates latest recap', () => {
        const latest = generateLatestRecap(trades);
        expect(latest).toBeTruthy();
        expect(latest!.tradeCount).toBe(1);
        expect(latest!.netPnl).toBe(-100);
    });

    it('returns empty for no trades', () => {
        expect(generateSessionRecaps([])).toHaveLength(0);
        expect(generateLatestRecap([])).toBeNull();
    });
});

// ─── Position Sizing ────────────────────────────────────────────

describe('Position Sizing', () => {
    describe('Kelly Criterion', () => {
        it('calculates half-Kelly for positive edge', () => {
            const result = kellySize({ winRate: 0.55, avgWin: 200, avgLoss: 100, halfKelly: true });
            expect(result.riskPercent).toBeGreaterThan(0);
            expect(result.riskPercent).toBeLessThan(25);
            expect(result.details.edge).toBeGreaterThan(0);
        });

        it('returns 0 for no edge', () => {
            const result = kellySize({ winRate: 0.3, avgWin: 100, avgLoss: 200 });
            expect(result.positionSize).toBe(0);
            expect(result.riskPercent).toBe(0);
        });

        it('returns 0 for invalid inputs', () => {
            expect(kellySize({ winRate: 0, avgWin: 100, avgLoss: 100 }).positionSize).toBe(0);
            expect(kellySize({ winRate: 0.5, avgWin: 0, avgLoss: 100 }).positionSize).toBe(0);
        });
    });

    describe('Fixed-Fractional', () => {
        it('calculates position size correctly', () => {
            const result = fixedFractionalSize({
                equity: 100000,
                riskPercent: 1, // 1% = $1000
                stopLossDistance: 100,
                pricePerUnit: 42000,
            });
            expect(result.riskAmount).toBe(1000);
            expect(result.positionSize).toBe(10); // $1000 / $100 stop = 10 units
        });

        it('returns 0 for invalid inputs', () => {
            expect(fixedFractionalSize({ equity: 0, riskPercent: 1, stopLossDistance: 100, pricePerUnit: 100 }).positionSize).toBe(0);
        });
    });

    describe('ATR-Based', () => {
        it('adjusts size based on volatility', () => {
            const result = atrSize({
                equity: 100000,
                riskPercent: 1,
                atr: 500,
                atrMultiplier: 2,
                pricePerUnit: 42000,
            });
            expect(result.riskAmount).toBe(1000);
            expect(result.positionSize).toBe(1); // $1000 / (500 × 2) = 1 unit
            expect(result.details.stopDistance).toBe(1000);
        });

        it('returns 0 for zero ATR', () => {
            expect(atrSize({ equity: 100000, riskPercent: 1, atr: 0, pricePerUnit: 100 }).positionSize).toBe(0);
        });
    });
});
