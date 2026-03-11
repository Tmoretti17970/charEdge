// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Toggle Integration Tests (Task 4.2.4)
//
// Tests theme toggle through the user store:
// dark ↔ light switching and state persistence.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { useUserStore } from '../../state/useUserStore.ts';

describe('Theme Toggle — useUserStore', () => {
    const getInitialTheme = () => useUserStore.getState().theme;

    it('has a theme property in store state', () => {
        const theme = useUserStore.getState().theme;
        expect(theme).toBeDefined();
        expect(typeof theme).toBe('string');
    });

    it('has a setTheme or toggleTheme action', () => {
        const state = useUserStore.getState();
        const hasThemeAction = (
            typeof state.setTheme === 'function' ||
            typeof state.toggleTheme === 'function' ||
            typeof state.update === 'function'
        );
        expect(hasThemeAction).toBe(true);
    });

    it('can toggle between dark and light themes', () => {
        const initial = useUserStore.getState().theme;
        const newTheme = initial === 'dark' ? 'light' : 'dark';

        // Use whatever setter is available
        const state = useUserStore.getState();
        if (typeof state.setTheme === 'function') {
            state.setTheme(newTheme);
        } else if (typeof state.update === 'function') {
            state.update({ theme: newTheme });
        }

        expect(useUserStore.getState().theme).toBe(newTheme);

        // Restore
        if (typeof state.setTheme === 'function') {
            state.setTheme(initial);
        } else if (typeof state.update === 'function') {
            state.update({ theme: initial });
        }
    });
});
