// Load persisted quick styles from localStorage
let _savedQuickStyles = null;
try {
  const raw = localStorage.getItem('charEdge-quick-styles');
  if (raw) _savedQuickStyles = JSON.parse(raw);
} catch {}

// Load persisted per-tool style memory
let _savedToolStyleMemory = null;
try {
  const raw = localStorage.getItem('charEdge-tool-style-memory');
  if (raw) _savedToolStyleMemory = JSON.parse(raw);
} catch {}

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
} catch {}

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

  setActiveTool: (tool) => set({ activeTool: tool }),
  setDrawingColor: (color) => set({ drawingColor: color }),
  toggleMagnetMode: () => set((s) => ({ magnetMode: !s.magnetMode })),
  setSelectedDrawing: (id) => set({ selectedDrawingId: id }),

  // Sticky mode
  toggleStickyMode: () => set((s) => ({ stickyMode: !s.stickyMode })),
  setStickyMode: (enabled) => set({ stickyMode: enabled }),

  // Sprint 12.3: Toolbar position (top | left | right)
  setToolbarPosition: (pos) => {
    try { localStorage.setItem('charEdge-toolbar-position', pos); } catch {}
    set({ toolbarPosition: pos });
  },

  // Quick-style presets
  setActiveQuickStyle: (id) => set({ activeQuickStyleId: id }),

  updateQuickStyle: (id, updates) => set((s) => {
    const styles = s.quickStyles.map((qs) =>
      qs.id === id ? { ...qs, ...updates } : qs
    );
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch {}
    return { quickStyles: styles };
  }),

  addQuickStyle: (style) => set((s) => {
    const id = `qs_${Date.now()}`;
    const styles = [...s.quickStyles, { id, lineWidth: 2, label: 'Custom', ...style }];
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch {}
    return { quickStyles: styles };
  }),

  removeQuickStyle: (id) => set((s) => {
    const styles = s.quickStyles.filter((qs) => qs.id !== id);
    try { localStorage.setItem('charEdge-quick-styles', JSON.stringify(styles)); } catch {}
    return {
      quickStyles: styles,
      activeQuickStyleId: s.activeQuickStyleId === id ? null : s.activeQuickStyleId,
    };
  }),

  resetQuickStyles: () => {
    try { localStorage.removeItem('charEdge-quick-styles'); } catch {}
    set({ quickStyles: DEFAULT_QUICK_STYLES, activeQuickStyleId: null });
  },

  // Per-tool style memory
  setToolStyleMemory: (toolType, style) => set((s) => {
    const memory = { ...s.toolStyleMemory, [toolType]: style };
    try { localStorage.setItem('charEdge-tool-style-memory', JSON.stringify(memory)); } catch {}
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
      drawingFuture: [...s.drawingFuture, s.drawings],
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
});
