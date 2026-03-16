// Load persisted quick styles from localStorage
let _savedQuickStyles = null;
try {
  const raw = localStorage.getItem('charEdge-quick-styles');
  if (raw) _savedQuickStyles = JSON.parse(raw);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

// Load persisted per-tool style memory
let _savedToolStyleMemory = null;
try {
  const raw = localStorage.getItem('charEdge-tool-style-memory');
  if (raw) _savedToolStyleMemory = JSON.parse(raw);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

const DEFAULT_QUICK_STYLES = [
  { id: 'qs1', color: '#2962FF', lineWidth: 2, label: 'Blue' },
  { id: 'qs2', color: '#EF5350', lineWidth: 2, label: 'Red' },
  { id: 'qs3', color: '#26A69A', lineWidth: 2, label: 'Teal' },
  { id: 'qs4', color: '#FF9800', lineWidth: 1.5, label: 'Orange' },
  { id: 'qs5', color: '#AB47BC', lineWidth: 1.5, label: 'Purple' },
];

// Load persisted toolbar position from localStorage
let _savedToolbarPosition = 'top';
try {
  const raw = localStorage.getItem('charEdge-toolbar-position');
  if (raw && ['top', 'left', 'right'].includes(raw)) _savedToolbarPosition = raw;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

// Load persisted per-tool drawing defaults (Batch 15)
let _savedDrawingDefaults = null;
try {
  const raw = localStorage.getItem('charEdge-drawing-defaults');
  if (raw) _savedDrawingDefaults = JSON.parse(raw);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

// Sprint 16: Load persisted fib presets
let _savedFibPresets = null;
try {
  const raw = localStorage.getItem('charEdge-fib-presets');
  if (raw) _savedFibPresets = JSON.parse(raw);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

export const createDrawingSlice = (set, get) => ({
  activeTool: null,
  drawingColor: '#2962FF',
  magnetMode: false,
  selectedDrawingId: null,
  drawings: [],
  drawingHistory: [],
  drawingFuture: [],

  // Sticky drawing mode
  stickyMode: false,
  activeQuickStyleId: null,

  // Quick-style presets (5 saved color/width combos)
  quickStyles: _savedQuickStyles || DEFAULT_QUICK_STYLES,

  // Per-tool last-used style memory
  toolStyleMemory: _savedToolStyleMemory || {},

  // Sprint 12.3: Toolbar position memory (top | left | right)
  toolbarPosition: _savedToolbarPosition,

  // Batch 15: Per-tool drawing defaults (fibLevels, visibility, labels, etc.)
  drawingDefaults: _savedDrawingDefaults || {},

  setActiveTool: (tool) => set({ activeTool: tool }),
  setDrawingColor: (color) => set({ drawingColor: color }),
  toggleMagnetMode: () => set((s) => ({ magnetMode: !s.magnetMode })),
  setSelectedDrawing: (id) => set({ selectedDrawingId: id }),

  // Sticky mode
  toggleStickyMode: () => set((s) => ({ stickyMode: !s.stickyMode })),
  setStickyMode: (enabled) => set({ stickyMode: enabled }),

  // Sprint 12.3: Toolbar position (top | left | right)
  setToolbarPosition: (pos) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-toolbar-position', pos); } catch (_) { /* ignored */ }
    set({ toolbarPosition: pos });
  },

  // Quick-style presets
  setActiveQuickStyle: (id) => set({ activeQuickStyleId: id }),

  updateQuickStyle: (id, updates) => set((s) => {
    const styles = s.quickStyles.map((qs) =>
      qs.id === id ? { ...qs, ...updates } : qs
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch (_) { /* ignored */ }
    return { quickStyles: styles };
  }),

  addQuickStyle: (style) => set((s) => {
    const id = `qs_${Date.now()}`;
    const styles = [...s.quickStyles, { id, lineWidth: 2, label: 'Custom', ...style }];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch (_) { /* ignored */ }
    return { quickStyles: styles };
  }),

  removeQuickStyle: (id) => set((s) => {
    const styles = s.quickStyles.filter((qs) => qs.id !== id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch (_) { /* ignored */ }
    return {
      quickStyles: styles,
      activeQuickStyleId: s.activeQuickStyleId === id ? null : s.activeQuickStyleId,
    };
  }),

  resetQuickStyles: () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.removeItem('charEdge-quick-styles'); } catch (_) { /* ignored */ }
    set({ quickStyles: DEFAULT_QUICK_STYLES, activeQuickStyleId: null });
  },

  // Per-tool style memory
  setToolStyleMemory: (toolType, style) => set((s) => {
    const memory = { ...s.toolStyleMemory, [toolType]: style };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-tool-style-memory', JSON.stringify(memory)); } catch (_) { /* ignored */ }
    return { toolStyleMemory: memory };
  }),

  /** Set drawings directly (no undo history push — used for toggle/lock). */
  setDrawings: (drawings) => set({ drawings }),

  /** Add a drawing and push current state to undo history. */
  addDrawing: (drawing) => set((s) => ({
    drawings: [...s.drawings, { ...drawing, id: drawing.id || `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }],
    drawingHistory: [...s.drawingHistory.slice(-49), s.drawings],
    drawingFuture: [],
  })),

  /** Remove a drawing by ID and push current state to undo history. */
  removeDrawing: (id) => set((s) => ({
    drawings: s.drawings.filter((d) => d.id !== id),
    drawingHistory: [...s.drawingHistory.slice(-49), s.drawings],
    drawingFuture: [],
    selectedDrawingId: s.selectedDrawingId === id ? null : s.selectedDrawingId,
  })),

  /** Undo last drawing action. */
  undoDrawing: () => {
    const s = get();
    if (s.drawingHistory.length === 0) return;
    const prev = s.drawingHistory[s.drawingHistory.length - 1];
    set({
      drawings: prev,
      drawingHistory: s.drawingHistory.slice(0, -1),
      drawingFuture: [...s.drawingFuture.slice(-49), s.drawings], // BUG-11: cap future at 50
    });
  },

  /** Redo previously undone drawing action. */
  redoDrawing: () => {
    const s = get();
    if (s.drawingFuture.length === 0) return;
    const next = s.drawingFuture[s.drawingFuture.length - 1];
    set({
      drawings: next,
      drawingHistory: [...s.drawingHistory, s.drawings],
      drawingFuture: s.drawingFuture.slice(0, -1),
    });
  },

  // Batch 15: Per-tool drawing defaults
  setDrawingDefault: (toolType, defaults) => set((s) => {
    const drawingDefaults = { ...s.drawingDefaults, [toolType]: { ...(s.drawingDefaults[toolType] || {}), ...defaults } };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-drawing-defaults', JSON.stringify(drawingDefaults)); } catch (_) { /* ignored */ }
    return { drawingDefaults };
  }),

  resetDrawingDefaults: (toolType) => set((s) => {
    const drawingDefaults = { ...s.drawingDefaults };
    delete drawingDefaults[toolType];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-drawing-defaults', JSON.stringify(drawingDefaults)); } catch (_) { /* ignored */ }
    return { drawingDefaults };
  }),

  // Sprint 11: Auto S/R detection
  autoSREnabled: true,
  autoSRSensitivity: 'standard' as 'tight' | 'standard' | 'loose',
  dismissedSRLevels: new Set<string>(),

  setAutoSREnabled: (enabled) => set({ autoSREnabled: enabled }),
  setAutoSRSensitivity: (sensitivity) => set({ autoSRSensitivity: sensitivity }),
  dismissSRLevel: (id) => set((s) => {
    const dismissed = new Set(s.dismissedSRLevels);
    dismissed.add(id);
    return { dismissedSRLevels: dismissed };
  }),
  resetDismissedSR: () => set({ dismissedSRLevels: new Set() }),

  // Sprint 12: Auto trendline detection
  autoTrendlinesEnabled: true,
  dismissedTrendlines: new Set<string>(),

  setAutoTrendlinesEnabled: (enabled) => set({ autoTrendlinesEnabled: enabled }),
  dismissTrendline: (id) => set((s) => {
    const dismissed = new Set(s.dismissedTrendlines);
    dismissed.add(id);
    return { dismissedTrendlines: dismissed };
  }),
  resetDismissedTrendlines: () => set({ dismissedTrendlines: new Set() }),

  // Sprint 14: Drawing groups for multi-select
  drawingGroups: {} as Record<string, string[]>, // groupId -> drawingId[]

  createGroup: (drawingIds) => set((s) => {
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const groups = { ...s.drawingGroups, [groupId]: [...drawingIds] };
    // Tag each drawing with groupId
    const drawings = s.drawings.map(d =>
      drawingIds.includes(d.id) ? { ...d, _groupId: groupId } : d
    );
    return { drawingGroups: groups, drawings };
  }),

  ungroup: (groupId) => set((s) => {
    const groups = { ...s.drawingGroups };
    const memberIds = groups[groupId] || [];
    delete groups[groupId];
    const drawings = s.drawings.map(d =>
      memberIds.includes(d.id) ? { ...d, _groupId: null } : d
    );
    return { drawingGroups: groups, drawings };
  }),

  getGroupMembers: (groupId) => {
    const s = get();
    return s.drawingGroups[groupId] || [];
  },

  // Sprint 16: Fibonacci level presets
  fibPresets: _savedFibPresets || {},

  saveFibPreset: (name, levels) => set((s) => {
    const presets = { ...s.fibPresets, [name]: levels };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-fib-presets', JSON.stringify(presets)); } catch (_) { /* ignored */ }
    return { fibPresets: presets };
  }),

  deleteFibPreset: (name) => set((s) => {
    const presets = { ...s.fibPresets };
    delete presets[name];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { localStorage.setItem('charEdge-fib-presets', JSON.stringify(presets)); } catch (_) { /* ignored */ }
    return { fibPresets: presets };
  }),

  // Sprint 19: Drawing sync across timeframes
  toggleDrawingSync: (drawingId) => {
    const s = get();
    const drawings = s.drawings || [];
    const drawing = drawings.find((d) => d.id === drawingId);
    if (drawing) {
      drawing.syncAcrossTimeframes = !drawing.syncAcrossTimeframes;
    }
  },

  syncAllDrawings: () => {
    const s = get();
    (s.drawings || []).forEach((d) => { d.syncAcrossTimeframes = true; });
  },

  unsyncAllDrawings: () => {
    const s = get();
    (s.drawings || []).forEach((d) => { d.syncAcrossTimeframes = false; });
  },
});
