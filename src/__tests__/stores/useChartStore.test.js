// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Store Unit Tests
//
// Tests for useChartStore (coreSlice, indicatorSlice, drawingSlice).
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// We test the slices in isolation to avoid needing full store setup
import { createCoreSlice } from '../../state/chart/coreSlice.ts';

describe('Chart Store — Core Slice', () => {
    let state;
    const mockSet = (partial) => {
        state = { ...state, ...partial };
    };
    const mockGet = () => state;

    beforeEach(() => {
        state = createCoreSlice(mockSet, mockGet);
    });

    it('initializes with default symbol BTC', () => {
        expect(state.symbol).toBe('BTC');
    });

    it('initializes with default timeframe 1h', () => {
        expect(state.tf).toBe('1h');
    });

    it('setSymbol uppercases the input', () => {
        state.setSymbol('eth');
        expect(state.symbol).toBe('ETH');
    });

    it('setSymbol handles already uppercase input', () => {
        state.setSymbol('SOL');
        expect(state.symbol).toBe('SOL');
    });

    it('setTf updates timeframe', () => {
        state.setTf('15m');
        expect(state.tf).toBe('15m');
    });

    it('setChartType updates chart type', () => {
        state.setChartType('line');
        expect(state.chartType).toBe('line');
    });

    it('setScaleMode to log also sets logScale true', () => {
        state.setScaleMode('log');
        expect(state.scaleMode).toBe('log');
        expect(state.logScale).toBe(true);
    });

    it('setScaleMode to linear also sets logScale false', () => {
        state.setScaleMode('log');
        state.setScaleMode('linear');
        expect(state.scaleMode).toBe('linear');
        expect(state.logScale).toBe(false);
    });

    it('toggleLogScale flips between log and linear', () => {
        expect(state.logScale).toBe(false);
        state.toggleLogScale();
        expect(state.logScale).toBe(true);
        expect(state.scaleMode).toBe('log');
        state.toggleLogScale();
        expect(state.logScale).toBe(false);
        expect(state.scaleMode).toBe('linear');
    });

    it('setCandleMode maps standard to candlestick', () => {
        state.setCandleMode('standard');
        expect(state.chartType).toBe('candlestick');
    });

    it('setCandleMode maps heikinashi correctly', () => {
        state.setCandleMode('heikinashi');
        expect(state.chartType).toBe('heikinashi');
    });

    it('setCandleMode falls back to candlestick for unknown mode', () => {
        state.setCandleMode('unknown_mode');
        expect(state.chartType).toBe('candlestick');
    });

    it('getSmartTimeframe returns current tf when no telemetry', () => {
        // No telemetry data exists, should fall back to current tf
        expect(state.getSmartTimeframe()).toBe('1h');
    });
});
