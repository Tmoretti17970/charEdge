// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeFormModal Source Tests (Task 4.1.5)
//
// Source-verification tests for the trade entry/edit form modal.
// Tests: form fields, validation, submit, edit mode.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync('src/app/components/dialogs/TradeFormModal.jsx', 'utf8');

describe('TradeFormModal', () => {
    it('exports TradeFormModal', () => {
        expect(src).toContain('export { TradeFormModal }');
    });

    it('accepts isOpen, onClose, editTrade props', () => {
        expect(src).toContain('isOpen');
        expect(src).toContain('onClose');
        expect(src).toContain('editTrade');
    });

    it('has all essential trade form fields', () => {
        expect(src).toContain('symbol');
        expect(src).toContain('entry');
        expect(src).toContain('exit');
        expect(src).toContain('qty');
        expect(src).toContain('side');
    });

    it('supports long and short sides', () => {
        expect(src).toContain("'long'");
        expect(src).toContain("'short'");
    });

    it('supports multiple asset classes', () => {
        expect(src).toContain("'futures'");
        expect(src).toContain("'crypto'");
        expect(src).toContain("'stocks'");
    });

    it('has validation logic', () => {
        expect(src).toContain('validate');
        expect(src).toContain('symbol');
    });

    it('has handleSubmit that adds or updates trade', () => {
        expect(src).toContain('handleSubmit');
        expect(src).toContain('addTrade');
        expect(src).toContain('updateTrade');
    });

    it('auto-calculates P&L from entry/exit/qty/side', () => {
        expect(src).toContain('autoCalcPnl');
    });

    it('supports edit mode with pre-filled data', () => {
        expect(src).toContain('editTrade');
        // When editTrade is provided, form pre-fills
        expect(src).toContain('editTrade.symbol') || expect(src).toContain('editTrade?.symbol');
    });

    it('supports screenshot attachments', () => {
        expect(src).toContain('screenshot') || expect(src).toContain('Screenshot');
        expect(src).toContain('_processScreenshot');
    });

    it('imports useJournalStore for trade persistence', () => {
        expect(src).toContain('useJournalStore');
    });
});
