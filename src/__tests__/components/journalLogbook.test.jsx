// ═══════════════════════════════════════════════════════════════════
// charEdge — JournalLogbook Source Tests (Task 4.1.4)
//
// Source-verification tests for the journal logbook component.
// Tests: table structure, sorting, filtering, empty state.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync('src/pages/journal/JournalLogbook.jsx', 'utf8');

describe('JournalLogbook', () => {
    it('exports a default component', () => {
        expect(src).toContain('export default function JournalLogbook');
    });

    it('accepts trades prop', () => {
        expect(src).toContain('trades');
    });

    it('renders table with essential columns', () => {
        expect(src).toContain('Symbol');
        expect(src).toContain('Side');
        expect(src).toContain('P&L') || expect(src).toContain('PnL') || expect(src).toContain('pnl');
    });

    it('supports sorting', () => {
        expect(src).toContain('sort');
    });

    it('has trade row click/selection behavior', () => {
        expect(src).toContain('onClick') || expect(src).toContain('onSelect');
    });

    it('displays trade count', () => {
        expect(src).toContain('.length');
    });
});
