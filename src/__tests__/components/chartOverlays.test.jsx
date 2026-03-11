// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Overlays Source Tests (Task 4.1.3)
//
// Source-verification tests for OrderEntryOverlay, RiskGuardOverlay,
// TradeMarkerOverlay, and TradePLPill chart overlay components.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const read = (rel) => fs.readFileSync(`src/${rel}`, 'utf8');

// ═══════════════════════════════════════════════════════════════════
// OrderEntryOverlay (358 lines)
// ═══════════════════════════════════════════════════════════════════

describe('OrderEntryOverlay', () => {
    const src = read('app/components/chart/overlays/OrderEntryOverlay.jsx');

    it('exports default component', () => {
        expect(src).toContain('export default function OrderEntryOverlay');
    });

    it('accepts required props', () => {
        expect(src).toContain('symbol');
        expect(src).toContain('price');
        expect(src).toContain('currentPrice');
        expect(src).toContain('onClose');
    });

    it('supports all order types: market, limit, stop, stop_limit', () => {
        expect(src).toContain('value="market"');
        expect(src).toContain('value="limit"');
        expect(src).toContain('value="stop"');
        expect(src).toContain('value="stop_limit"');
    });

    it('auto-detects buy/sell side from price vs currentPrice', () => {
        expect(src).toContain("price >= currentPrice ? 'sell' : 'buy'");
    });

    it('has quick quantity buttons', () => {
        expect(src).toContain('[0.25, 0.5, 0.75, 1]');
    });

    it('shows estimated cost', () => {
        expect(src).toContain('Est. Cost');
    });

    it('has SL/TP inputs', () => {
        expect(src).toContain('Stop Loss');
        expect(src).toContain('Take Profit');
    });

    it('uses both paper and live trading', () => {
        expect(src).toContain('paperStore.placeOrder');
        expect(src).toContain('alpacaAdapter.placeOrder');
    });
});

// ═══════════════════════════════════════════════════════════════════
// RiskGuardOverlay
// ═══════════════════════════════════════════════════════════════════

describe('RiskGuardOverlay', () => {
    const src = read('app/components/chart/overlays/RiskGuardOverlay.jsx');

    it('exports a default component', () => {
        expect(src).toContain('export default function RiskGuardOverlay');
    });

    it('imports CSS module', () => {
        expect(src).toContain('RiskGuardOverlay.module.css');
    });

    it('evaluates risk against prop firm profile', () => {
        expect(src).toContain('activeProfile');
        expect(src).toContain('usePropFirmStore');
    });

    it('has status levels', () => {
        expect(src).toContain('danger') || expect(src).toContain('warning') || expect(src).toContain('safe');
    });
});

// ═══════════════════════════════════════════════════════════════════
// TradeMarkerOverlay
// ═══════════════════════════════════════════════════════════════════

describe('TradeMarkerOverlay', () => {
    const src = read('app/components/chart/overlays/TradeMarkerOverlay.jsx');

    it('exports a default component', () => {
        expect(src).toContain('export default function TradeMarkerOverlay');
    });

    it('renders trade entry/exit markers', () => {
        expect(src).toContain('entry');
        expect(src).toContain('exit');
    });

    it('uses trade data from props', () => {
        expect(src).toContain('trade');
        expect(src).toContain('onDismiss');
    });
});

// ═══════════════════════════════════════════════════════════════════
// TradePLPill
// ═══════════════════════════════════════════════════════════════════

describe('TradePLPill', () => {
    const src = read('app/components/chart/overlays/TradePLPill.jsx');

    it('exports a default component', () => {
        expect(src).toContain('export default function TradePLPill');
    });

    it('displays P&L with color coding', () => {
        expect(src).toContain('totalPL');
        expect(src).toContain('computeTradeStats');
    });

    it('tracks wins and losses', () => {
        expect(src).toContain('wins');
        expect(src).toContain('losses');
    });
});
