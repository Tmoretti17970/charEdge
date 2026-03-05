// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Template Slice
// Extracted from ChartTemplateStore for useChartStore consolidation.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'tf_chart_templates';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function saveToStorage(templates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (_) { /* quota exceeded — silently fail */ }
}

export const createTemplateSlice = (set, get) => ({
  // ─── Template State ───────────────────────────────────────────
  templates: loadFromStorage(),
  activeTemplateId: null,

  // ─── Template Actions ─────────────────────────────────────────
  saveTemplate: (name, config) => {
    const newTemplate = {
      id: `tmpl_${Date.now()}`,
      name,
      ...(config || {}),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => {
      const templates = [...s.templates, newTemplate];
      saveToStorage(templates);
      return { templates, activeTemplateId: newTemplate.id };
    });
    return newTemplate;
  },

  loadTemplate: (templateId) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (!template) return null;

    // Support both legacy { config: {...} } and flat { chartType, timeframe, ... }
    const config = template.config || template;
    set((s) => ({
      activeTemplateId: templateId,
      // Apply template settings to chart state
      ...(config.chartType ? { chartType: config.chartType } : {}),
      ...(config.timeframe ? { timeframe: config.timeframe } : {}),
    }));

    // Apply indicators if present
    if (config.indicators && Array.isArray(config.indicators)) {
      const { setIndicators } = get();
      if (setIndicators) setIndicators(config.indicators);
    }

    return template;
  },

  updateTemplate: (templateId, updates) => {
    set((s) => {
      const templates = s.templates.map((t) =>
        t.id === templateId
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t,
      );
      saveToStorage(templates);
      return { templates };
    });
  },

  deleteTemplate: (templateId) => {
    set((s) => {
      const templates = s.templates.filter((t) => t.id !== templateId);
      saveToStorage(templates);
      return {
        templates,
        activeTemplateId: s.activeTemplateId === templateId ? null : s.activeTemplateId,
      };
    });
  },

  renameTemplate: (templateId, newName) => {
    get().updateTemplate(templateId, { name: newName });
  },

  getTemplate: (templateId) => get().templates.find((t) => t.id === templateId) || null,
});
