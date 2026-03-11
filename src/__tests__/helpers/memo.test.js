// ═══════════════════════════════════════════════════════════════════
// charEdge — React.memo Boundary Tests
// Verifies all performance-critical components are wrapped in memo.
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const SRC = path.resolve('src');

function isMemoized(relPath) {
  const c = fs.readFileSync(path.join(SRC, relPath), 'utf-8');
  return c.indexOf('React.memo') !== -1 || c.indexOf('export default memo(') !== -1;
}

// ─── Tier 1: Hot path ────────────────────────────────────────────
describe('React.memo — Tier 1: Hot path', function () {
  it('JournalTradeRow is memoized', function () {
    expect(isMemoized('app/features/journal/journal_ui/JournalTradeRow.jsx')).toBe(true);
  });

  it('LiveTicker is memoized', function () {
    expect(isMemoized('app/misc/components/LiveTicker.jsx')).toBe(true);
  });
});

// ─── Tier 2: Chart components ────────────────────────────────────
describe('React.memo — Tier 2: Charts', function () {
  it('EquityCurveChart is memoized', function () {
    expect(isMemoized('app/components/widgets/EquityCurveChart.jsx')).toBe(true);
  });
  it('DailyPnlChart is memoized', function () {
    expect(isMemoized('app/components/widgets/DailyPnlChart.jsx')).toBe(true);
  });
  it('BreakdownBarChart is memoized', function () {
    expect(isMemoized('app/components/widgets/BreakdownBarChart.jsx')).toBe(true);
  });
  it('WinRateDonut is memoized', function () {
    expect(isMemoized('app/components/widgets/WinRateDonut.jsx')).toBe(true);
  });
});

// ─── Tier 3: Analytics tabs ──────────────────────────────────────
describe('React.memo — Tier 3: Analytics tabs', function () {
  it('OverviewTab is memoized', function () {
    expect(isMemoized('app/features/analytics/analytics_ui/OverviewTab.jsx')).toBe(true);
  });
  it('StrategiesTab is memoized', function () {
    expect(isMemoized('app/features/analytics/analytics_ui/StrategiesTab.jsx')).toBe(true);
  });
  it('PsychologyTab is memoized', function () {
    expect(isMemoized('app/features/analytics/analytics_ui/PsychologyTab.jsx')).toBe(true);
  });
  it('TimingTab is memoized', function () {
    expect(isMemoized('app/features/analytics/analytics_ui/TimingTab.jsx')).toBe(true);
  });
  it('RiskTab is memoized', function () {
    expect(isMemoized('app/features/analytics/analytics_ui/RiskTab.jsx')).toBe(true);
  });
});

// ─── Heavy components ────────────────────────────────────────────
describe('React.memo — Heavy components', function () {
  it('PlaybookDashboard is memoized', function () {
    expect(isMemoized('app/features/playbook/PlaybookDashboard.jsx')).toBe(true);
  });
});

// ─── Total count ─────────────────────────────────────────────────
describe('React.memo — Total count', function () {
  it('at least 12 components are memoized', function () {
    let count = 0;
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '__tests__') {
          walk(full);
        } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
          const text = fs.readFileSync(full, 'utf-8');
          if (text.indexOf('React.memo') !== -1 || text.indexOf('export default memo(') !== -1) {
            count++;
          }
        }
      }
    }
    walk(SRC);
    expect(count).toBeGreaterThanOrEqual(12);
  });
});
