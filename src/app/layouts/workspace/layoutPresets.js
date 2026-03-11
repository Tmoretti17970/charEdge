// ═══════════════════════════════════════════════════════════════════
// WorkspaceLayout — Layout Presets & Storage
// Dockable preset definitions and localStorage persistence.
// ═══════════════════════════════════════════════════════════════════


// ─── Global Config ──────────────────────────────────────────────

const GLOBAL_CONFIG = {
    tabEnableFloat: false,
    tabSetEnableMaximize: true,
    tabSetEnableClose: false,
    splitterSize: 4,
    tabSetHeaderHeight: 30,
    tabSetTabStripHeight: 30,
    borderBarSize: 0,
};

function chartTab(symbol, tf) {
    return {
        type: 'tab',
        name: `${symbol} · ${tf.toUpperCase()}`,
        component: 'chart',
        config: { symbol, tf },
    };
}

// ─── Preset Definitions ─────────────────────────────────────────

export const LAYOUT_PRESETS = {
    default: {
        label: 'Chart + Sidebar',
        icon: '◧',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                weight: 100,
                children: [
                    {
                        type: 'tabset',
                        weight: 70,
                        children: [chartTab('BTC', '3m')],
                    },
                    {
                        type: 'column',
                        weight: 30,
                        children: [
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Watchlist', component: 'watchlist' }] },
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Journal', component: 'journal-mini' }] },
                        ],
                    },
                ],
            },
        },
    },
    single: {
        label: 'Single Chart',
        icon: '□',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [{ type: 'tabset', children: [chartTab('BTC', '3m')] }],
            },
        },
    },
    '2x1': {
        label: '2 Charts',
        icon: '▥',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 50, children: [chartTab('BTC', '3m')] },
                    { type: 'tabset', weight: 50, children: [chartTab('ETH', '3m')] },
                ],
            },
        },
    },
    '2x2': {
        label: '4 Charts',
        icon: '⊞',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    {
                        type: 'column',
                        weight: 50,
                        children: [
                            { type: 'tabset', weight: 50, children: [chartTab('ES', '1d')] },
                            { type: 'tabset', weight: 50, children: [chartTab('NQ', '1d')] },
                        ],
                    },
                    {
                        type: 'column',
                        weight: 50,
                        children: [
                            { type: 'tabset', weight: 50, children: [chartTab('BTC', '1d')] },
                            { type: 'tabset', weight: 50, children: [chartTab('SPY', '1d')] },
                        ],
                    },
                ],
            },
        },
    },
    '3x1': {
        label: '3 Charts',
        icon: '▤',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 33, children: [chartTab('ES', '1d')] },
                    { type: 'tabset', weight: 34, children: [chartTab('NQ', '1d')] },
                    { type: 'tabset', weight: 33, children: [chartTab('BTC', '1d')] },
                ],
            },
        },
    },
    journal: {
        label: 'Journal Focus',
        icon: '◨',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 55, children: [chartTab('BTC', '3m')] },
                    {
                        type: 'column',
                        weight: 45,
                        children: [
                            { type: 'tabset', weight: 40, children: [{ type: 'tab', name: 'Journal', component: 'journal-mini' }] },
                            {
                                type: 'tabset',
                                weight: 60,
                                children: [{ type: 'tab', name: 'Analytics', component: 'analytics-mini' }],
                            },
                        ],
                    },
                ],
            },
        },
    },
    insights: {
        label: 'Insights Focus',
        icon: '🔍',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 55, children: [chartTab('SPY', '1d')] },
                    {
                        type: 'column',
                        weight: 45,
                        children: [
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'AI Insights', component: 'insights' }] },
                            {
                                type: 'tabset',
                                weight: 50,
                                children: [
                                    { type: 'tab', name: 'Journal', component: 'journal-mini' },
                                    { type: 'tab', name: 'Alerts', component: 'alerts' },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
    scalper: {
        label: 'The Scalper',
        icon: '⚡',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    {
                        type: 'column',
                        weight: 50,
                        children: [
                            { type: 'tabset', weight: 50, children: [chartTab('BTC', '1m')] },
                            { type: 'tabset', weight: 50, children: [chartTab('ETH', '1m')] },
                        ],
                    },
                    {
                        type: 'column',
                        weight: 50,
                        children: [
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Watchlist', component: 'watchlist' }] },
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Journal', component: 'journal-mini' }] },
                        ],
                    },
                ],
            },
        },
    },
    swing: {
        label: 'The Swing',
        icon: '🌊',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 60, children: [chartTab('SPY', '1D')] },
                    {
                        type: 'column',
                        weight: 40,
                        children: [
                            { type: 'tabset', weight: 50, children: [chartTab('BTC', '1D')] },
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Compare', component: 'compare' }] },
                        ],
                    },
                ],
            },
        },
    },
    researcher: {
        label: 'The Researcher',
        icon: '🔬',
        json: {
            global: GLOBAL_CONFIG,
            layout: {
                type: 'row',
                children: [
                    { type: 'tabset', weight: 45, children: [chartTab('BTC', '4h')] },
                    {
                        type: 'column',
                        weight: 55,
                        children: [
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'AI Insights', component: 'insights' }] },
                            { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Compare', component: 'compare' }] },
                        ],
                    },
                ],
            },
        },
    },
};

// ─── Storage Key & Persistence ──────────────────────────────────

const STORAGE_KEY = 'charEdge-workspace-layout';

export function loadLayout() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const json = JSON.parse(saved);
            json.global = { ...(json.global || {}), ...GLOBAL_CONFIG };
            if (json.layout && json.layout.type) return json;
        }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
        /* corrupt data, use default */
    }
    return LAYOUT_PRESETS.default.json;
}

export function saveLayout(model) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model.toJson()));
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
        /* quota exceeded or private mode */
    }
}

export { STORAGE_KEY, chartTab };
