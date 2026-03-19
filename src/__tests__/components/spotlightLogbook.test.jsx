// ═══════════════════════════════════════════════════════════════════
// charEdge — Spotlight Logbook v2.0 Source Verification Tests
// Pattern: read source files and verify structure/exports/props
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const COMPONENT_PATH = path.resolve(__dirname, '../../app/components/ui/SpotlightLogbook.jsx');
const CSS_PATH = path.resolve(__dirname, '../../app/components/ui/SpotlightLogbook.module.css');
const SPARKLINE_PATH = path.resolve(__dirname, '../../app/components/ui/Sparkline.jsx');

describe('SpotlightLogbook v2.0 — Source Verification', () => {
    const src = fs.readFileSync(COMPONENT_PATH, 'utf-8');

    it('should exist and export a default component', () => {
        expect(src).toContain('export default');
    });

    it('should accept isOpen, onClose, and filterDate props', () => {
        expect(src).toContain('isOpen');
        expect(src).toContain('onClose');
        expect(src).toContain('filterDate');
    });

    it('should have a search input with placeholder', () => {
        expect(src).toContain('searchInput');
        expect(src).toContain('placeholder');
        expect(src).toMatch(/Search\s+symbols/);
    });

    it('should render sortable column definitions', () => {
        expect(src).toContain('COLUMNS');
        expect(src).toContain("id: 'date'");
        expect(src).toContain("id: 'symbol'");
        expect(src).toContain("id: 'pnl'");
        expect(src).toContain('sortable: true');
    });

    it('should have sorting state and handler', () => {
        expect(src).toContain('sortCol');
        expect(src).toContain('sortDir');
        expect(src).toContain('handleSort');
    });

    it('should have filter pills for side and date range', () => {
        expect(src).toContain('sideFilter');
        expect(src).toContain('dateRange');
        expect(src).toContain('DATE_RANGES');
        expect(src).toContain('filterPill');
    });

    it('should have bulk selection mode', () => {
        expect(src).toContain('bulkMode');
        expect(src).toContain('useBulkSelection');
        expect(src).toContain('BulkActionBar');
    });

    it('should have AI Grades toggle', () => {
        expect(src).toContain('showAIGrades');
        expect(src).toContain('gradeTrade');
        expect(src).toContain('aiBadge');
    });

    it('should have expandable trade detail rows', () => {
        expect(src).toContain('expandedId');
        expect(src).toContain('TradeDetail');
        expect(src).toContain('detailPanel');
    });

    it('should have Context Performance integration', () => {
        expect(src).toContain('ContextPerformanceTab');
        expect(src).toContain('showContextPerf');
    });

    it('should have filter summary bar', () => {
        expect(src).toContain('filterSummary');
        expect(src).toContain('isFiltered');
        expect(src).toContain('Clear all');
    });

    it('should render a trade table with Date, Symbol, Strategy, and P&L columns', () => {
        expect(src).toContain('tradeDate');
        expect(src).toContain('tradeSymbol');
        expect(src).toContain('tradeStrategy');
        expect(src).toContain('tradePnl');
    });

    it('should have an action bar footer with keyboard shortcuts', () => {
        expect(src).toContain('actionBar');
        expect(src).toContain('Expand');
        expect(src).toContain('Export');
        expect(src).toContain('Close');
        expect(src).toContain('ESC');
    });

    it('should import and use tradeSanitizer', () => {
        expect(src).toContain('sanitizeStrategy');
        expect(src).toContain('getAssetIcon');
        expect(src).toContain('tradeSanitizer');
    });

    it('should import and render Sparkline component', () => {
        expect(src).toContain("import Sparkline from './Sparkline.jsx'");
        expect(src).toContain('<Sparkline');
    });

    it('should implement stateful scroll memory (60s TTL)', () => {
        expect(src).toContain('MEMORY_TTL');
        expect(src).toContain('_savedScrollTop');
        expect(src).toContain('_savedScrollTime');
        expect(src).toContain('60_000');
    });

    it('should NOT have the old 15-row limit', () => {
        // v2.0 removed the MAX_ROWS cap
        expect(src).not.toContain('MAX_ROWS');
    });

    it('should use CSS module for Liquid Glass styling', () => {
        expect(src).toContain("import css from './SpotlightLogbook.module.css'");
        expect(src).toContain('css.overlay');
        expect(src).toContain('css.panel');
    });

    it('should use useJournalStore for trade data', () => {
        expect(src).toContain('useJournalStore');
    });

    it('should handle ⌘E export shortcut', () => {
        expect(src).toContain("e.key === 'e'");
        expect(src).toContain('handleExport');
        expect(src).toContain('text/csv');
    });

    it('should have trade action handlers (edit, delete, chart, replay)', () => {
        expect(src).toContain('charEdge:edit-trade');
        expect(src).toContain('charEdge:delete-confirm');
        expect(src).toContain('charEdge:view-trade-on-chart');
        expect(src).toContain('charEdge:replay-trade');
    });
});

describe('SpotlightLogbook.module.css — Source Verification', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf-8');

    it('should define the Liquid Glass panel class', () => {
        expect(css).toContain('.panel');
        expect(css).toContain('backdrop-filter');
        expect(css).toContain('blur(25px)');
    });

    it('should have the Apple hardware border (0.5px)', () => {
        expect(css).toContain('0.5px solid');
    });

    it('should have animation keyframes', () => {
        expect(css).toContain('spotlightFadeIn');
        expect(css).toContain('spotlightSlideUp');
    });

    it('should have light mode overrides', () => {
        expect(css).toContain('.theme-light');
    });

    it('should style the action bar', () => {
        expect(css).toContain('.actionBar');
        expect(css).toContain('.kbd');
    });

    it('should style sparkline tooltips', () => {
        expect(css).toContain('.sparklineTooltip');
    });

    it('should style the toolbar and filter pills', () => {
        expect(css).toContain('.toolbar');
        expect(css).toContain('.filterPill');
        expect(css).toContain('.toolbarBtn');
    });

    it('should style expanded detail panels', () => {
        expect(css).toContain('.detailPanel');
        expect(css).toContain('.detailGrid');
        expect(css).toContain('.detailActions');
        expect(css).toContain('.detailBtn');
    });

    it('should style sortable columns', () => {
        expect(css).toContain('.colHeader');
        expect(css).toContain('.sortArrow');
        expect(css).toContain('.tableHeader');
    });
});

describe('Sparkline — Source Verification', () => {
    const src = fs.readFileSync(SPARKLINE_PATH, 'utf-8');

    it('should export a memoized Sparkline component', () => {
        expect(src).toContain('React.memo(Sparkline)');
    });

    it('should render an SVG polyline', () => {
        expect(src).toContain('<polyline');
        expect(src).toContain('<svg');
    });

    it('should support area fill with gradient', () => {
        expect(src).toContain('linearGradient');
        expect(src).toContain('<path');
    });

    it('should use Apple green/red colors', () => {
        expect(src).toContain('#31D158');
        expect(src).toContain('#FF453A');
    });
});
