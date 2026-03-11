// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeFormModal Source Tests (Task 4.1.5)
//
// Source-verification tests for the trade entry/edit form modal.
// Tests: form fields, validation, submit, edit mode.
// After decomposition, logic lives in the ./trade-form/ sub-modules.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const modalSrc = fs.readFileSync('src/app/components/dialogs/TradeFormModal.jsx', 'utf8');
const hookSrc = fs.readFileSync('src/app/components/dialogs/trade-form/useTradeForm.js', 'utf8');
const screenshotSrc = fs.readFileSync('src/app/components/dialogs/trade-form/ScreenshotSection.jsx', 'utf8');
// Combined source for assertions that span the decomposed modules
const src = modalSrc + '\n' + hookSrc + '\n' + screenshotSrc;

describe('TradeFormModal', () => {
    it('exports TradeFormModal', () => {
        expect(modalSrc).toContain('export { TradeFormModal }');
    });

    it('accepts isOpen, onClose, editTrade props', () => {
        expect(modalSrc).toContain('isOpen');
        expect(modalSrc).toContain('onClose');
        expect(modalSrc).toContain('editTrade');
    });

    it('has all essential trade form fields', () => {
        expect(src).toContain('symbol');
        expect(src).toContain('entry');
        expect(src).toContain('exit');
        expect(src).toContain('qty');
        expect(src).toContain('side');
    });

    it('supports long and short sides', () => {
        // After decomposition, SIDES is imported from tradeConstants
        expect(modalSrc).toContain('SIDES');
    });

    it('supports multiple asset classes', () => {
        // Asset class constants now imported from tradeConstants
        expect(src).toContain('assetClass');
    });

    it('has validation logic', () => {
        expect(hookSrc).toContain('validate');
        expect(hookSrc).toContain('symbol');
    });

    it('has handleSubmit that adds or updates trade', () => {
        expect(src).toContain('handleSubmit');
        expect(hookSrc).toContain('addTrade');
        expect(hookSrc).toContain('updateTrade');
    });

    it('auto-calculates P&L from entry/exit/qty/side', () => {
        expect(src).toContain('autoCalcPnl');
    });

    it('supports edit mode with pre-filled data', () => {
        expect(hookSrc).toContain('editTrade');
        // When editTrade is provided, form pre-fills
        expect(hookSrc).toContain('editTrade.symbol');
    });

    it('supports screenshot attachments', () => {
        expect(src).toContain('Screenshot');
        // After decomposition, processScreenshot lives in hook + ScreenshotSection
        expect(src).toContain('processScreenshot');
    });

    it('imports useJournalStore for trade persistence', () => {
        expect(hookSrc).toContain('useJournalStore');
    });
});
