// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tool Defaults Store
// Task 1.4.16: Persistent default styles for drawing tools
//
// Stores user-preferred line thickness, color, and style per tool type.
// Defaults are persisted to localStorage and applied when creating
// new drawings.
//
// Usage:
//   const { getDefaults, setDefault } = useDrawingDefaultsStore();
//   const defaults = getDefaults('trendline');
//   setDefault('trendline', 'lineWidth', 3);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

/** Drawing style properties that can have user-configured defaults */
export interface DrawingDefaults {
    lineWidth: number;
    lineColor: string;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fillColor: string;
    fillOpacity: number;
    fontSize: number;
    fontColor: string;
}

/** Full default set per tool type */
export type ToolDefaults = Record<string, Partial<DrawingDefaults>>;

/** Built-in factory defaults by tool category */
const FACTORY_DEFAULTS: ToolDefaults = {
    trendline: { lineWidth: 2, lineColor: '#2962FF', lineStyle: 'solid' },
    hline: { lineWidth: 1, lineColor: '#787B86', lineStyle: 'dashed' },
    ray: { lineWidth: 2, lineColor: '#2962FF', lineStyle: 'solid' },
    channel: { lineWidth: 2, lineColor: '#2962FF', lineStyle: 'solid', fillColor: '#2962FF', fillOpacity: 0.1 },
    rectangle: { lineWidth: 1, lineColor: '#2962FF', lineStyle: 'solid', fillColor: '#2962FF', fillOpacity: 0.15 },
    ellipse: { lineWidth: 1, lineColor: '#2962FF', lineStyle: 'solid', fillColor: '#2962FF', fillOpacity: 0.15 },
    fibonacci: { lineWidth: 1, lineColor: '#787B86', lineStyle: 'dashed' },
    text: { fontSize: 14, fontColor: '#D1D4DC' },
    arrow: { lineWidth: 2, lineColor: '#2962FF', lineStyle: 'solid' },
    ruler: { lineWidth: 1, lineColor: '#787B86', lineStyle: 'dashed' },
};

const STORAGE_KEY = 'tf_drawing_defaults';

interface DrawingDefaultsState {
    /** User overrides per tool type */
    userDefaults: ToolDefaults;

    /** Get merged defaults for a tool type (factory + user overrides) */
    getDefaults: (toolType: string) => Partial<DrawingDefaults>;

    /** Set a single default property for a tool type */
    setDefault: <K extends keyof DrawingDefaults>(toolType: string, key: K, value: DrawingDefaults[K]) => void;

    /** Reset a tool type to factory defaults */
    resetDefaults: (toolType: string) => void;

    /** Reset all to factory defaults */
    resetAll: () => void;
}

const useDrawingDefaultsStore = create<DrawingDefaultsState>((set, get) => {
    // Load from localStorage
    let initial: ToolDefaults = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) initial = JSON.parse(raw);
    } catch { /* storage may be blocked */ }

    return {
        userDefaults: initial,

        getDefaults: (toolType: string) => {
            const factory = FACTORY_DEFAULTS[toolType] || {};
            const user = get().userDefaults[toolType] || {};
            return { ...factory, ...user };
        },

        setDefault: (toolType, key, value) => {
            set((s) => {
                const updated = {
                    ...s.userDefaults,
                    [toolType]: { ...(s.userDefaults[toolType] || {}), [key]: value },
                };
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                } catch { /* storage may be blocked */ }
                return { userDefaults: updated };
            });
        },

        resetDefaults: (toolType) => {
            set((s) => {
                const updated = { ...s.userDefaults };
                delete updated[toolType];
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                } catch { /* storage may be blocked */ }
                return { userDefaults: updated };
            });
        },

        resetAll: () => {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch { /* storage may be blocked */ }
            set({ userDefaults: {} });
        },
    };
});

export { useDrawingDefaultsStore, FACTORY_DEFAULTS };
export default useDrawingDefaultsStore;
