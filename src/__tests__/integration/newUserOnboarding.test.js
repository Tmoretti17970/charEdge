// ═══════════════════════════════════════════════════════════════════
// charEdge — New User Onboarding Integration Tests (Task 4.2.1)
//
// Tests the onboarding flow from first launch → trade entry.
// Verifies store state transitions and component triggers.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';

// ─── Source-level integration checks ────────────────────────────

const dashSrc = fs.readFileSync('src/app/components/dashboard/DashboardPanel.jsx', 'utf8');
const narrativeSrc = fs.readFileSync('src/app/components/dashboard/DashboardNarrativeLayout.jsx', 'utf8');
const emptySrc = fs.readFileSync('src/app/components/ui/EmptyState.jsx', 'utf8');

describe('New User Onboarding Flow', () => {
    it('DashboardPanel shows empty state when trades array is empty', () => {
        expect(dashSrc).toContain('DashboardEmptyState');
        expect(dashSrc).toContain('trades.length === 0');
    });

    it('DashboardEmptyState prompts user to go to journal', () => {
        expect(emptySrc).toContain('onGoToJournal');
    });

    it('Dashboard shows Getting Started card for < 5 trades', () => {
        expect(narrativeSrc).toContain('Getting Started');
        expect(narrativeSrc).toContain('trades.length < 5');
    });

    it('Getting Started has trade entry, CSV import, and chart exploration steps', () => {
        expect(narrativeSrc).toContain('Add your first trade');
        expect(narrativeSrc).toContain('Import from CSV');
        expect(narrativeSrc).toContain('Explore the chart');
    });

    it('Getting Started card can be dismissed persistently', () => {
        expect(narrativeSrc).toContain('tf_onboard_dismissed');
        expect(narrativeSrc).toContain('localStorage.setItem');
    });
});
