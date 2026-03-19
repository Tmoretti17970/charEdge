// ═══════════════════════════════════════════════════════════════════
// charEdge — IntelligenceSection Source Tests (Phase 2)
//
// Source-verification tests for the Intelligence settings section.
// Matches existing settingsPage.test.jsx pattern.
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync('src/app/components/settings/IntelligenceSection.jsx', 'utf8');

describe('IntelligenceSection', () => {
    it('exports default component', () => {
        expect(src).toContain('export default');
        expect(src).toContain('IntelligenceSection');
    });

    it('contains Engine group', () => {
        expect(src).toContain('EngineGroup');
        expect(src).toContain('WebLLM');
    });

    it('contains Personality group', () => {
        expect(src).toContain('PersonalityGroup');
        expect(src).toContain('tone');
        expect(src).toContain('verbosity');
        expect(src).toContain('frequency');
    });

    it('contains Context Sources group', () => {
        expect(src).toContain('ContextGroup');
        expect(src).toContain('Trader DNA');
        expect(src).toContain('Journal History');
        expect(src).toContain('Chart Context');
        expect(src).toContain('Watchlist Data');
    });

    it('contains Cloud AI group', () => {
        expect(src).toContain('CloudAIGroup');
        expect(src).toContain('Gemini');
        expect(src).toContain('Groq');
    });

    it('contains Privacy group', () => {
        expect(src).toContain('PrivacyGroup');
        expect(src).toContain('Clear AI Memory');
        expect(src).toContain('Clear Learned Preferences');
    });

    it('imports webLLMProvider', () => {
        expect(src).toContain('webLLMProvider');
    });

    it('imports adaptiveCoach', () => {
        expect(src).toContain('adaptiveCoach');
    });

    it('imports conversationMemory', () => {
        expect(src).toContain('conversationMemory');
    });

    it('has reset functionality', () => {
        expect(src).toContain('handleClearMemory');
        expect(src).toContain('handleClearPrefs');
        expect(src).toContain('handleReset');
    });

    it('references model tiers', () => {
        expect(src).toContain('getAvailableModels');
        expect(src).toContain('loadModel');
    });
});
