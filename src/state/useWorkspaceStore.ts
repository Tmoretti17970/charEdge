// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Workspace Manager (TypeScript)
//
// Save and restore named workspace configurations.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { safeClone } from '@/shared/safeJSON';

// ─── Types ──────────────────────────────────────────────────────

export interface IndicatorConfig {
    type: string;
    params: Record<string, unknown>;
    color: string;
}

export interface ChartSettings {
    symbol: string;
    tf: string;
    chartType: string;
    logScale: boolean;
    orderFlow: boolean;
    indicators: IndicatorConfig[];
}

export interface PanelSettings {
    showDOM: boolean;
    showMinimap: boolean;
    showStatusBar: boolean;
    focusMode: boolean;
}

export interface WorkspaceState {
    page: string;
    chart: ChartSettings;
    panels?: PanelSettings;
    journal?: Record<string, unknown>;
    zen: boolean;
}

export interface Workspace {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    builtIn?: boolean;
    createdAt: number;
    updatedAt: number;
    state: WorkspaceState;
}

export interface WorkspacePreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    builtIn: boolean;
    state: WorkspaceState;
}

interface StoreRefs {
    uiStore?: { getState: () => Record<string, unknown> };
    chartStore?: { getState: () => Record<string, unknown> };
}

export interface WorkspaceStoreState {
    workspaces: Workspace[];
    activeId: string | null;
    activePreset: string | null;
    loaded: boolean;
    save: (name: string, state: WorkspaceState) => Workspace;
    load: (id: string) => WorkspaceState | null;
    remove: (id: string) => void;
    rename: (id: string, newName: string) => void;
    duplicate: (id: string) => Workspace | null;
    hydrate: (data: Workspace[]) => void;
    exportAll: () => string;
    importAll: (json: string) => number;
    applyPreset: (presetId: string) => WorkspaceState | null;
    saveCustomPreset: (name: string, state: WorkspaceState) => Workspace;
    clearActivePreset: () => void;
}

// ─── Built-in Workspace Presets ─────────────────────────────────

export const BUILT_IN_PRESETS: WorkspacePreset[] = [
    {
        id: 'scalper',
        name: 'Scalper',
        icon: '⚡',
        description: '1m–5m charts, fast indicators, DOM + order flow',
        builtIn: true,
        state: {
            page: 'charts',
            chart: {
                symbol: 'ES', tf: '1m', chartType: 'candles', logScale: false, orderFlow: true,
                indicators: [
                    { type: 'ema', params: { period: 9 }, color: '#22d3ee' },
                    { type: 'ema', params: { period: 21 }, color: '#f59e0b' },
                    { type: 'vwap', params: {}, color: '#a855f7' },
                ],
            },
            panels: { showDOM: true, showMinimap: false, showStatusBar: true, focusMode: false },
            zen: false,
        },
    },
    {
        id: 'swing',
        name: 'Swing',
        icon: '🌊',
        description: '1H–4H charts, trend indicators, clean layout',
        builtIn: true,
        state: {
            page: 'charts',
            chart: {
                symbol: 'ES', tf: '4h', chartType: 'candles', logScale: false, orderFlow: false,
                indicators: [
                    { type: 'sma', params: { period: 50 }, color: '#f59e0b' },
                    { type: 'sma', params: { period: 200 }, color: '#ef4444' },
                    { type: 'rsi', params: { period: 14 }, color: '#22d3ee' },
                    { type: 'macd', params: { fast: 12, slow: 26, signal: 9 }, color: '#a855f7' },
                ],
            },
            panels: { showDOM: false, showMinimap: true, showStatusBar: true, focusMode: false },
            zen: false,
        },
    },
    {
        id: 'analyst',
        name: 'Analyst',
        icon: '🔬',
        description: 'Daily charts, all tools visible, maximum data',
        builtIn: true,
        state: {
            page: 'charts',
            chart: {
                symbol: 'ES', tf: '1d', chartType: 'candles', logScale: false, orderFlow: false,
                indicators: [
                    { type: 'sma', params: { period: 20 }, color: '#f59e0b' },
                    { type: 'sma', params: { period: 50 }, color: '#a855f7' },
                    { type: 'sma', params: { period: 200 }, color: '#ef4444' },
                    { type: 'rsi', params: { period: 14 }, color: '#22d3ee' },
                    { type: 'bbands', params: { period: 20, stdDev: 2 }, color: '#6366f1' },
                ],
            },
            panels: { showDOM: false, showMinimap: true, showStatusBar: true, focusMode: false },
            zen: false,
        },
    },
    {
        id: 'clean',
        name: 'Clean',
        icon: '✨',
        description: 'Minimal chart, no indicators, focus mode',
        builtIn: true,
        state: {
            page: 'charts',
            chart: {
                symbol: 'ES', tf: '15m', chartType: 'candles', logScale: false, orderFlow: false,
                indicators: [],
            },
            panels: { showDOM: false, showMinimap: false, showStatusBar: false, focusMode: true },
            zen: false,
        },
    },
];

// ─── Default workspace template ─────────────────────────────────

function defaultWorkspace(name: string): Workspace {
    return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: {
            page: 'dashboard',
            chart: {
                symbol: 'ES',
                tf: '5m',
                chartType: 'candles',
                logScale: false,
                orderFlow: false,
                indicators: [
                    { type: 'sma', params: { period: 20 }, color: '#f59e0b' },
                    { type: 'ema', params: { period: 50 }, color: '#a855f7' },
                ],
            },
            journal: {
                sortCol: 'date',
                sortDir: 'desc',
                search: '',
                filterSide: 'all',
            },
            zen: false,
        },
    };
}

// ─── Snapshot: capture current app state for workspace ──────────

export function captureState(stores: StoreRefs): WorkspaceState {
    const ui = stores.uiStore?.getState?.() || {} as Record<string, unknown>;
    const chart = stores.chartStore?.getState?.() || {} as Record<string, unknown>;

    return {
        page: (ui.page as string) || 'dashboard',
        chart: {
            symbol: (chart.symbol as string) || 'ES',
            tf: (chart.tf as string) || '5m',
            chartType: (chart.chartType as string) || 'candles',
            logScale: (chart.logScale as boolean) || false,
            orderFlow: (chart.orderFlow as boolean) || false,
            indicators: ((chart.indicators as IndicatorConfig[]) || []).map((ind) => ({
                type: ind.type,
                params: { ...ind.params },
                color: ind.color,
            })),
        },
        zen: (ui.zenMode as boolean) || false,
    };
}

export function restoreState(state: WorkspaceState, stores: StoreRefs): void {
    if (!state) return;

    const ui = stores.uiStore?.getState?.() as Record<string, (...args: unknown[]) => void> | undefined;
    const chart = stores.chartStore?.getState?.() as Record<string, unknown> | undefined;

    if (ui) {
        if (state.page) ui.setPage?.(state.page);
        if (state.zen != null && (ui as unknown as { zenMode: boolean }).zenMode !== state.zen) ui.toggleZen?.();
    }

    if (chart && state.chart) {
        const chartActions = chart as Record<string, (...args: unknown[]) => void>;
        if (state.chart.symbol) chartActions.setSymbol?.(state.chart.symbol);
        if (state.chart.tf) chartActions.setTf?.(state.chart.tf);
        if (state.chart.chartType) chartActions.setChartType?.(state.chart.chartType);

        if (state.chart.indicators) {
            const existing = (chart.indicators as Array<IndicatorConfig & { id?: string }>) || [];
            for (const ind of existing) {
                if (ind.id) chartActions.removeIndicator?.(ind.id);
            }
            for (const ind of state.chart.indicators) {
                chartActions.addIndicator?.(ind);
            }
        }
    }
}

// ─── Workspace Store ────────────────────────────────────────────

const MAX_WORKSPACES = 20;

const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
    workspaces: [],
    activeId: null,
    activePreset: null,
    loaded: false,

    save: (name: string, state: WorkspaceState): Workspace => {
        const s = get();
        const trimmedName = (name || 'Untitled').trim().slice(0, 50);
        const existing = s.workspaces.find((w) => w.name === trimmedName);

        if (existing) {
            const updated: Workspace = {
                ...existing,
                state: { ...state },
                updatedAt: Date.now(),
            };
            set({
                workspaces: s.workspaces.map((w) => (w.id === existing.id ? updated : w)),
                activeId: existing.id,
            });
            return updated;
        }

        const ws: Workspace = {
            ...defaultWorkspace(trimmedName),
            state: { ...state },
        };

        const newList = [ws, ...s.workspaces];
        while (newList.length > MAX_WORKSPACES) newList.pop();

        set({ workspaces: newList, activeId: ws.id });
        return ws;
    },

    load: (id: string): WorkspaceState | null => {
        const ws = get().workspaces.find((w) => w.id === id);
        if (!ws) return null;
        set({ activeId: id });
        return ws.state;
    },

    remove: (id: string) => {
        set((s) => ({
            workspaces: s.workspaces.filter((w) => w.id !== id),
            activeId: s.activeId === id ? null : s.activeId,
        }));
    },

    rename: (id: string, newName: string) => {
        set((s) => ({
            workspaces: s.workspaces.map((w) =>
                w.id === id ? { ...w, name: (newName || 'Untitled').trim().slice(0, 50), updatedAt: Date.now() } : w,
            ),
        }));
    },

    duplicate: (id: string): Workspace | null => {
        const ws = get().workspaces.find((w) => w.id === id);
        if (!ws) return null;

        const copy: Workspace = {
            ...defaultWorkspace(`${ws.name} (Copy)`),
            state: safeClone(ws.state, {} as WorkspaceState) as WorkspaceState,
        };

        set((s) => ({
            workspaces: [copy, ...s.workspaces].slice(0, MAX_WORKSPACES),
        }));
        return copy;
    },

    hydrate: (data: Workspace[]) => {
        set({ workspaces: Array.isArray(data) ? data : [], loaded: true });
    },

    exportAll: (): string => {
        return JSON.stringify(get().workspaces, null, 2);
    },

    importAll: (json: string): number => {
        try {
            const imported = JSON.parse(json) as Workspace[];
            if (!Array.isArray(imported)) return 0;

            const existing = get().workspaces;
            const existingNames = new Set(existing.map((w) => w.name));
            const newOnes = imported.filter((w) => w.name && !existingNames.has(w.name));

            set({ workspaces: [...existing, ...newOnes].slice(0, MAX_WORKSPACES) });
            return newOnes.length;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            return 0;
        }
    },

    applyPreset: (presetId: string): WorkspaceState | null => {
        const preset = BUILT_IN_PRESETS.find((p) => p.id === presetId);
        if (!preset) return null;
        set({ activePreset: presetId, activeId: null });
        return safeClone(preset.state, {} as WorkspaceState) as WorkspaceState;
    },

    saveCustomPreset: (name: string, state: WorkspaceState): Workspace => {
        const ws = get().save(name, state);
        set({ activePreset: ws.id });
        return ws;
    },

    clearActivePreset: () => set({ activePreset: null }),
}));

// ─── Public API (non-React) ─────────────────────────────────────

export const workspaceManager = {
    save: (name: string, state: WorkspaceState) => useWorkspaceStore.getState().save(name, state),
    load: (id: string) => useWorkspaceStore.getState().load(id),
    remove: (id: string) => useWorkspaceStore.getState().remove(id),
    rename: (id: string, name: string) => useWorkspaceStore.getState().rename(id, name),
    duplicate: (id: string) => useWorkspaceStore.getState().duplicate(id),
    list: () => useWorkspaceStore.getState().workspaces,
    exportAll: () => useWorkspaceStore.getState().exportAll(),
    importAll: (json: string) => useWorkspaceStore.getState().importAll(json),
};

// ─── Exports ────────────────────────────────────────────────────

export { useWorkspaceStore, defaultWorkspace, MAX_WORKSPACES };
export default workspaceManager;
