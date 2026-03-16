// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Presets  (Sprint 15)
// Named style presets ("My S/R Style") with built-in and user presets.
// Stored in localStorage. Import/export as JSON.
// ═══════════════════════════════════════════════════════════════════

export interface DrawingPreset {
  id: string;
  name: string;
  color: string;
  lineWidth: number;
  dash: number[];
  fillColor?: string;
  opacity?: number;
  isBuiltIn?: boolean;
}

// ── Built-in Presets ──

const BUILTIN_PRESETS: DrawingPreset[] = [
  {
    id: 'preset_tv_classic',
    name: 'TradingView Classic',
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    isBuiltIn: true,
  },
  {
    id: 'preset_minimal_dark',
    name: 'Minimal Dark',
    color: '#787B86',
    lineWidth: 1,
    dash: [6, 4],
    isBuiltIn: true,
  },
  {
    id: 'preset_high_contrast',
    name: 'High Contrast',
    color: '#FFEB3B',
    lineWidth: 3,
    dash: [],
    isBuiltIn: true,
  },
  {
    id: 'preset_support',
    name: 'Support Line',
    color: '#26A69A',
    lineWidth: 2,
    dash: [6, 4],
    isBuiltIn: true,
  },
  {
    id: 'preset_resistance',
    name: 'Resistance Line',
    color: '#EF5350',
    lineWidth: 2,
    dash: [6, 4],
    isBuiltIn: true,
  },
];

const STORAGE_KEY = 'charEdge-drawing-presets';

// ── CRUD ──

function loadUserPresets(): DrawingPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: DrawingPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch { /* storage blocked */ }
}

/**
 * List all presets (built-in + user).
 */
export function listPresets(): DrawingPreset[] {
  return [...BUILTIN_PRESETS, ...loadUserPresets()];
}

/**
 * Save a new user preset.
 */
export function savePreset(preset: Omit<DrawingPreset, 'id'>): DrawingPreset {
  const full: DrawingPreset = {
    ...preset,
    id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    isBuiltIn: false,
  };
  const presets = loadUserPresets();
  presets.push(full);
  saveUserPresets(presets);
  return full;
}

/**
 * Delete a user preset by ID. Built-in presets cannot be deleted.
 */
export function deletePreset(id: string): boolean {
  const presets = loadUserPresets();
  const filtered = presets.filter(p => p.id !== id);
  if (filtered.length === presets.length) return false;
  saveUserPresets(filtered);
  return true;
}

/**
 * Apply a preset's style to a drawing object (in-place mutation).
 */
export function applyPreset(drawing: any, preset: DrawingPreset): void {
  if (!drawing?.style) return;
  drawing.style.color = preset.color;
  drawing.style.lineWidth = preset.lineWidth;
  drawing.style.dash = preset.dash;
  if (preset.fillColor) drawing.style.fillColor = preset.fillColor;
  if (preset.opacity != null) drawing.style.opacity = preset.opacity;
}

/**
 * Export all user presets as JSON string.
 */
export function exportPresets(): string {
  return JSON.stringify(loadUserPresets(), null, 2);
}

/**
 * Import presets from JSON string. Merges with existing.
 */
export function importPresets(json: string): number {
  try {
    const imported: DrawingPreset[] = JSON.parse(json);
    if (!Array.isArray(imported)) return 0;
    const existing = loadUserPresets();
    const existingIds = new Set(existing.map(p => p.id));
    let added = 0;
    for (const p of imported) {
      if (!p.name || !p.color) continue;
      if (existingIds.has(p.id)) {
        p.id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      }
      p.isBuiltIn = false;
      existing.push(p);
      added++;
    }
    saveUserPresets(existing);
    return added;
  } catch {
    return 0;
  }
}
