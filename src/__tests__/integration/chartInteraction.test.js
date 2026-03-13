// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Interaction Integration Tests (Task 4.2.3)
//
// Source-verification tests for chart interaction flows:
// symbol change → data fetch, indicator pipeline, drawing persistence.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect, vi } from 'vitest';

const read = (rel) => fs.readFileSync(`src/${rel}`, 'utf8');

// Mock telemetry to avoid import side effects
vi.mock('../../utils/telemetry.js', () => ({
    trackFirstAction: vi.fn(),
    trackWorkflow: vi.fn(),
}));

describe('Chart Interaction — Symbol Change', () => {
    const coreSliceSrc = read('state/chart/coreSlice.ts');

    it('coreSlice tracks current symbol', () => {
        expect(coreSliceSrc).toContain("symbol:");
    });

    it('coreSlice has setSymbol action', () => {
        expect(coreSliceSrc).toContain('setSymbol');
    });

    it('setSymbol uppercases the symbol', () => {
        expect(coreSliceSrc).toContain('toUpperCase');
    });
});

describe('Chart Interaction — Store Integration', () => {
    it('useChartStore has symbol in state', async () => {
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const state = useChartStore.getState();
        expect(state.symbol).toBeDefined();
        expect(typeof state.symbol).toBe('string');
    });

    it('setSymbol updates symbol in store', async () => {
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const initial = useChartStore.getState().symbol;
        useChartStore.getState().setSymbol('eth');
        expect(useChartStore.getState().symbol).toBe('ETH');
        // Restore
        useChartStore.getState().setSymbol(initial);
    });
});

describe('Chart Interaction — Indicator Pipeline', () => {
    const computeSrc = read('data/engine/infra/ComputeWorkerPool.js');

    it('ComputeWorkerPool exists', () => {
        expect(computeSrc).toBeDefined();
    });

    it('handles worker pool lifecycle', () => {
        expect(computeSrc).toContain('Worker') || expect(computeSrc).toContain('worker');
    });
});

describe('Chart Interaction — Alert Store', () => {
    const alertSrc = read('state/useAlertStore.ts');

    it('useAlertStore exports store', () => {
        expect(alertSrc).toContain('useAlertStore');
        expect(alertSrc).toContain('create');
    });

    it('has alert management actions', () => {
        expect(alertSrc).toContain('addAlert') || expect(alertSrc).toContain('set');
    });
});

// NOTE: Drawing Annotations tests removed — useAnnotationStore.ts was deleted.
// Drawing annotations are now managed through useChartStore.drawings.
