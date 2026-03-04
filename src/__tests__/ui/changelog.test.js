// ═══════════════════════════════════════════════════════════════════
// charEdge — Changelog Tests
// Validates ChangelogPage structure, data integrity, and routing.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Data validation ────────────────────────────────────────────

describe('Changelog — Data Integrity', () => {
  let CHANGELOG_ENTRIES;

  it('imports CHANGELOG_ENTRIES from ChangelogPage', async () => {
    const mod = await import('../../pages/ChangelogPage.jsx');
    CHANGELOG_ENTRIES = mod.CHANGELOG_ENTRIES;
    expect(Array.isArray(CHANGELOG_ENTRIES)).toBe(true);
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThanOrEqual(1);
  });

  it('every entry has required fields (version, date, tag, title, items)', async () => {
    const { CHANGELOG_ENTRIES } = await import('../../pages/ChangelogPage.jsx');
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry).toHaveProperty('version');
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('tag');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('items');
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(['major', 'minor', 'patch']).toContain(entry.tag);
      expect(Array.isArray(entry.items)).toBe(true);
    }
  });

  it('every item has valid type and text', async () => {
    const { CHANGELOG_ENTRIES } = await import('../../pages/ChangelogPage.jsx');
    const validTypes = ['new', 'fix', 'polish', 'perf'];
    for (const entry of CHANGELOG_ENTRIES) {
      for (const item of entry.items) {
        expect(validTypes).toContain(item.type);
        expect(typeof item.text).toBe('string');
        expect(item.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('versions are in descending order (newest first)', async () => {
    const { CHANGELOG_ENTRIES } = await import('../../pages/ChangelogPage.jsx');
    for (let i = 1; i < CHANGELOG_ENTRIES.length; i++) {
      const a = CHANGELOG_ENTRIES[i - 1].date;
      const b = CHANGELOG_ENTRIES[i].date;
      expect(new Date(a).getTime()).toBeGreaterThanOrEqual(new Date(b).getTime());
    }
  });

  it('v11.0.0 entry exists with ≥10 items', async () => {
    const { CHANGELOG_ENTRIES } = await import('../../pages/ChangelogPage.jsx');
    const v11 = CHANGELOG_ENTRIES.find((e) => e.version === '11.0.0');
    expect(v11).toBeDefined();
    expect(v11.items.length).toBeGreaterThanOrEqual(10);
  });

  it('v11.0.0 includes all four item types', async () => {
    const { CHANGELOG_ENTRIES } = await import('../../pages/ChangelogPage.jsx');
    const v11 = CHANGELOG_ENTRIES.find((e) => e.version === '11.0.0');
    const types = new Set(v11.items.map((i) => i.type));
    expect(types.has('new')).toBe(true);
    expect(types.has('fix')).toBe(true);
    expect(types.has('polish')).toBe(true);
    expect(types.has('perf')).toBe(true);
  });
});

// ─── Component validation ───────────────────────────────────────

describe('Changelog — Component', () => {
  it('ChangelogPage exports a default function', async () => {
    const mod = await import('../../pages/ChangelogPage.jsx');
    expect(typeof mod.default).toBe('function');
  });
});

// ─── Routing integration ────────────────────────────────────────

describe('Changelog — Routing', () => {
  it('PageRouter PAGES map includes "changelog" key', () => {
    const src = readFileSync(resolve(__dirname, '../../app/layouts/PageRouter.jsx'), 'utf8');
    // Check for the PAGES map entry
    expect(src).toContain('changelog:');
    expect(src).toContain('ChangelogPage');
  });

  it('PageRouter PAGE_LABELS includes "changelog" entry', () => {
    const src = readFileSync(resolve(__dirname, '../../app/layouts/PageRouter.jsx'), 'utf8');
    expect(src).toMatch(/changelog.*What.*New/);
  });

  it('Sidebar includes a What\'s New link', () => {
    const src = readFileSync(resolve(__dirname, '../../app/layouts/Sidebar.jsx'), 'utf8');
    expect(src).toContain("setPage('changelog')");
    expect(src).toContain("What's New");
  });
});
