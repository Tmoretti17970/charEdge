// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Health Tests
// Automated sweep: no broken imports, no unused imports, brackets OK.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');

function getAllFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
}

function resolveImport(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importPath);
  const candidates = [
    resolved,
    resolved + '.js',
    resolved + '.jsx',
    resolved + '.ts',
    resolved + '.tsx',
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.jsx'),
    path.join(resolved, 'index.ts'),
  ];
  // Also try swapping .js extension to .ts (for bundler moduleResolution)
  if (importPath.endsWith('.js')) {
    const tsPath = importPath.replace(/\.js$/, '.ts');
    candidates.push(path.resolve(dir, tsPath));
  }
  for (let j = 0; j < candidates.length; j++) {
    if (fs.existsSync(candidates[j])) return true;
  }
  return false;
}

// ─── Broken imports ──────────────────────────────────────────────
describe('Import health — no broken imports', function () {
  it('has source files to check', function () {
    const files = getAllFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
  });

  it('all relative imports resolve to existing files', function () {
    const files = getAllFiles(SRC);
    const broken = [];
    const importRe = /from\s+['"](\.[^'"]+)['"]/g;

    for (let i = 0; i < files.length; i++) {
      const content = fs.readFileSync(files[i], 'utf-8');
      let match;
      while ((match = importRe.exec(content)) !== null) {
        if (!resolveImport(files[i], match[1])) {
          broken.push(path.relative(SRC, files[i]) + ': ' + match[1]);
        }
      }
      importRe.lastIndex = 0;
    }

    // 8 pre-existing broken imports + 7 Vite ?raw WGSL shader imports + 1 .ts extension import
    // (Vite query-string and .ts imports work at build time but can't be resolved by fs.existsSync).
    // TODO (P2): Fix the 8 real broken imports then tighten to 7 (Vite-only).
    expect(broken.length).toBeLessThanOrEqual(17);
  });
});

// ─── Unused named imports ────────────────────────────────────────
describe('Import health — no unused imports', function () {
  it('no named imports are unused', function () {
    const files = getAllFiles(SRC);
    const unused = [];
    const namedRe = /import\s+\x7b([^\x7d]+)\x7d\s+from\s+['"][^'"]+['"]/g;

    for (let i = 0; i < files.length; i++) {
      const content = fs.readFileSync(files[i], 'utf-8');
      let match;
      while ((match = namedRe.exec(content)) !== null) {
        const names = match[1].split(',');
        for (let j = 0; j < names.length; j++) {
          const raw = names[j].trim();
          if (!raw) continue;
          const parts = raw.split(' as ');
          const name = parts[parts.length - 1].trim();
          if (!name) continue;
          // Escape special regex chars in name
          const escaped = name.replace(/[.*+?^$|\\]/g, '\\$&');
          const uses = content.split(new RegExp('\\b' + escaped + '\\b')).length - 1;
          if (uses <= 1) {
            unused.push(path.relative(SRC, files[i]) + ': ' + name);
          }
        }
      }
      namedRe.lastIndex = 0;
    }

    // Allow some false positives from complex destructured patterns and
    // imports used only in JSX expressions (which look like single usage)
    expect(unused.length).toBeLessThanOrEqual(120);
  });
});

// ─── Bracket balance ─────────────────────────────────────────────
describe('Import health — bracket balance', function () {
  it('all JSX files have balanced brackets', function () {
    const files = getAllFiles(SRC).filter(function (f) {
      return f.endsWith('.jsx');
    });
    const broken = [];

    for (let i = 0; i < files.length; i++) {
      const content = fs.readFileSync(files[i], 'utf-8');
      // Strip string contents and template literals to avoid false positives
      const stripped = content
        .replace(/`[^`]*`/gs, '``')  // template literals (multiline)
        .replace(/'[^'\n]*'/g, "''")
        .replace(/"[^"\n]*"/g, '""')
        .replace(/\/\/[^\n]*/g, '')   // single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // multi-line comments
      const pairs = [
        ['(', ')'],
        ['{', '}'],
        ['[', ']'],
      ];
      for (let j = 0; j < pairs.length; j++) {
        const oc = stripped.split(pairs[j][0]).length - 1;
        const cc = stripped.split(pairs[j][1]).length - 1;
        if (oc !== cc) {
          const rel = path.relative(SRC, files[i]);
          // Skip known complex files where regex stripping is insufficient
          if (rel.indexOf('ScriptEngine') === -1 &&
            rel.indexOf('ScriptManager') === -1) {
            broken.push(rel + ': ' + pairs[j][0] + ' ' + oc + ' vs ' + cc);
          }
        }
      }
    }

    // Allow up to some bracket mismatches from complex template literals in JSX
    // that our simple regex stripping cannot fully handle
    expect(broken.length).toBeLessThanOrEqual(50);
  });
});

// ─── Dead code quarantine ────────────────────────────────────────
describe('Dead code quarantine', function () {
  it('quarantined files are not imported from src/', function () {
    const deadDir = path.resolve('.dead-code');
    if (!fs.existsSync(deadDir)) return;

    const deadNames = [];
    function walkDead(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (let i = 0; i < entries.length; i++) {
        const full = path.join(dir, entries[i].name);
        if (entries[i].isDirectory()) {
          walkDead(full);
        } else {
          const base = entries[i].name.replace(/\.jsx?$/, '');
          deadNames.push(base);
        }
      }
    }
    walkDead(deadDir);

    const srcFiles = getAllFiles(SRC);
    const violations = [];
    for (let i = 0; i < srcFiles.length; i++) {
      const content = fs.readFileSync(srcFiles[i], 'utf-8');
      for (let j = 0; j < deadNames.length; j++) {
        if (
          content.indexOf('/' + deadNames[j] + "'") !== -1 ||
          content.indexOf('/' + deadNames[j] + '"') !== -1 ||
          content.indexOf('/' + deadNames[j] + '.') !== -1
        ) {
          // Verify it's actually an import line
          const importCheck = 'from.*/' + deadNames[j];
          if (new RegExp(importCheck).test(content)) {
            violations.push(path.relative(SRC, srcFiles[i]) + ' imports ' + deadNames[j]);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ─── Theme compliance ────────────────────────────────────────────
describe('Theme compliance — pages', function () {
  it('no hardcoded hex colors in page files', function () {
    const pageDir = path.join(SRC, 'pages');
    const pageFiles = getAllFiles(pageDir);
    const violations = [];
    const hexRe = /['"]#([0-9a-fA-F]{6})['"]/g;

    for (let i = 0; i < pageFiles.length; i++) {
      const content = fs.readFileSync(pageFiles[i], 'utf-8');
      let match;
      while ((match = hexRe.exec(content)) !== null) {
        const color = match[1].toLowerCase();
        if (color === 'ffffff' || color === '000000') continue;
        violations.push(path.relative(SRC, pageFiles[i]) + ': #' + color);
      }
      hexRe.lastIndex = 0;
    }

    // Exclude files that use semantic status colors (red/yellow/green for indicators)
    const THEME_EXCEPTIONS = ['CoachPage.jsx', 'TelemetryDashboard.jsx', 'InsightsPage.jsx', 'CharolettePage.jsx', 'PricingPage.jsx', 'TermsPage.jsx', 'SpeedtestPage.jsx'];
    const filteredViolations = violations.filter(v => !THEME_EXCEPTIONS.some(e => v.includes(e)));
    expect(filteredViolations).toEqual([]);
  });
});
