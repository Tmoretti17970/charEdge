// ═══════════════════════════════════════════════════════════════════
// charEdge — UI Store Unit Tests
//
// Tests for useUIStore — page navigation, settings toggle, panels.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../state/useUIStore';

describe('UI Store', () => {
    beforeEach(() => {
        // Reset store to defaults between tests
        useUIStore.setState({
            page: 'journal',
            settingsOpen: false,
        });
    });

    it('initializes with journal page', () => {
        const { page } = useUIStore.getState();
        expect(page).toBe('journal');
    });

    it('setPage changes active page', () => {
        useUIStore.getState().setPage('charts');
        expect(useUIStore.getState().page).toBe('charts');
    });

    it('setPage to discover works', () => {
        useUIStore.getState().setPage('discover');
        expect(useUIStore.getState().page).toBe('discover');
    });

    it('toggleSettings flips settings panel open/closed', () => {
        const initial = useUIStore.getState().settingsOpen;
        useUIStore.getState().toggleSettings();
        expect(useUIStore.getState().settingsOpen).toBe(!initial);
        useUIStore.getState().toggleSettings();
        expect(useUIStore.getState().settingsOpen).toBe(initial);
    });
});
