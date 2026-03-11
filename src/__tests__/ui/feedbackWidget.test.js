// ═══════════════════════════════════════════════════════════════════
// charEdge — Feedback Widget Tests
// Validates FeedbackWidget structure, exports, and App integration.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// ─── Component validation ───────────────────────────────────────

describe('FeedbackWidget — Component', () => {
  it('exports a default function', async () => {
    const mod = await import('../../app/components/ui/FeedbackWidget.jsx');
    expect(typeof mod.default).toBe('function');
  });

  it('exports FEEDBACK_TYPES with id, emoji, label, description', async () => {
    const { FEEDBACK_TYPES } = await import('../../app/components/ui/FeedbackWidget.jsx');
    expect(Array.isArray(FEEDBACK_TYPES)).toBe(true);
    expect(FEEDBACK_TYPES.length).toBe(3);
    for (const ft of FEEDBACK_TYPES) {
      expect(ft).toHaveProperty('id');
      expect(ft).toHaveProperty('emoji');
      expect(ft).toHaveProperty('label');
      expect(ft).toHaveProperty('description');
    }
  });

  it('includes idea, bug, and general feedback types', async () => {
    const { FEEDBACK_TYPES } = await import('../../app/components/ui/FeedbackWidget.jsx');
    const ids = FEEDBACK_TYPES.map((ft) => ft.id);
    expect(ids).toContain('idea');
    expect(ids).toContain('bug');
    expect(ids).toContain('general');
  });

  it('exports FEEDBACK_STORAGE_KEY as a string', async () => {
    const { FEEDBACK_STORAGE_KEY } = await import('../../app/components/ui/FeedbackWidget.jsx');
    expect(typeof FEEDBACK_STORAGE_KEY).toBe('string');
    expect(FEEDBACK_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('storage key follows charedge naming convention', async () => {
    const { FEEDBACK_STORAGE_KEY } = await import('../../app/components/ui/FeedbackWidget.jsx');
    expect(FEEDBACK_STORAGE_KEY).toMatch(/^charedge/);
  });
});

// ─── App integration ────────────────────────────────────────────

describe('FeedbackWidget — App Integration', () => {
  it('App.jsx lazy-imports FeedbackWidget', () => {
    const src = readFileSync(resolve(__dirname, '../../App.jsx'), 'utf8');
    expect(src).toContain('FeedbackWidget');
    // Verify it's lazy-loaded
    expect(src).toMatch(/React\.lazy\(.*FeedbackWidget/);
  });

  it('App.jsx renders <FeedbackWidget />', () => {
    const src = readFileSync(resolve(__dirname, '../../App.jsx'), 'utf8');
    expect(src).toContain('<FeedbackWidget');
  });

  it('FeedbackWidget renders inside Suspense block', () => {
    const src = readFileSync(resolve(__dirname, '../../App.jsx'), 'utf8');
    const suspenseStart = src.indexOf('<Suspense');
    const suspenseEnd = src.indexOf('</Suspense>');
    const feedbackPos = src.indexOf('<FeedbackWidget');
    expect(suspenseStart).toBeLessThan(feedbackPos);
    expect(feedbackPos).toBeLessThan(suspenseEnd);
  });
});
