// ═══════════════════════════════════════════════════════════════════
// charEdge — SettingsPage Source Tests (Task 4.1.6)
//
// Source-verification tests for the settings page component.
// Tests: exports, sections, theme toggle, search filter.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const src = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');

describe('SettingsPage', () => {
    it('exports default component', () => {
        expect(src).toContain('export default function SettingsPage');
    });

    it('accepts searchFilter prop', () => {
        expect(src).toContain('searchFilter');
    });

    it('imports useUserStore for user preferences', () => {
        expect(src).toContain('useUserStore');
    });

    it('has theme-related settings', () => {
        expect(src).toContain('theme');
    });

    it('has display or appearance settings', () => {
        expect(src).toContain('theme') || expect(src).toContain('display') || expect(src).toContain('appearance');
    });
});
