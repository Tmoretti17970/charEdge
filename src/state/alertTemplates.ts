// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Templates (Sprint 11)
//
// Save and reuse alert configurations as named templates.
//   - Save any alert config as a template
//   - Quick-apply template to new symbols
//   - Built-in presets (Breakout, Swing, Scalp, HODL)
//   - Template includes: conditions, thresholds, sound, frequency, repeat
//
// Usage:
//   import { useAlertTemplates } from './alertTemplates';
//   const { templates, save, apply, builtIns } = useAlertTemplates();
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** When this template was created */
  createdAt: number;
  /** Number of times this template has been applied */
  useCount: number;
  /** Alert conditions in this template */
  conditions: TemplateCondition[];
  /** Sound preference */
  soundType: string;
  /** Alert frequency (instant/balanced/quiet) */
  frequency: string;
  /** Repeat mode (once/repeat/persistent) */
  repeatMode: string;
  /** Whether this is a built-in preset */
  isBuiltIn?: boolean;
}

export interface TemplateCondition {
  type: string;       // above, below, percent_above, percent_below, 52w_high, 52w_low
  /** Offset from current price (e.g. +5% = 0.05) or absolute price */
  offsetPercent?: number;
  absolutePrice?: number;
  label: string;
}

// ─── Built-in Presets ───────────────────────────────────────────

export const BUILT_IN_TEMPLATES: AlertTemplate[] = [
  {
    id: 'builtin-breakout',
    name: 'Breakout Setup',
    description: 'Alerts for potential breakout: +3% above, -2% below for pullback entry',
    icon: '🚀',
    createdAt: 0,
    useCount: 0,
    conditions: [
      { type: 'percent_above', offsetPercent: 0.03, label: '+3% above current' },
      { type: 'percent_below', offsetPercent: 0.02, label: '-2% pullback entry' },
    ],
    soundType: 'price',
    frequency: 'instant',
    repeatMode: 'once',
    isBuiltIn: true,
  },
  {
    id: 'builtin-swing',
    name: 'Swing Trader',
    description: 'Key levels: ±5% moves and 52-week boundaries',
    icon: '📈',
    createdAt: 0,
    useCount: 0,
    conditions: [
      { type: 'percent_above', offsetPercent: 0.05, label: '+5% above current' },
      { type: 'percent_below', offsetPercent: 0.05, label: '-5% below current' },
      { type: '52w_high', label: '52-week high' },
      { type: '52w_low', label: '52-week low' },
    ],
    soundType: 'price',
    frequency: 'balanced',
    repeatMode: 'repeat',
    isBuiltIn: true,
  },
  {
    id: 'builtin-scalp',
    name: 'Scalp Alerts',
    description: 'Tight alerts for quick trades: ±1% moves',
    icon: '⚡',
    createdAt: 0,
    useCount: 0,
    conditions: [
      { type: 'percent_above', offsetPercent: 0.01, label: '+1% above' },
      { type: 'percent_below', offsetPercent: 0.01, label: '-1% below' },
    ],
    soundType: 'urgent',
    frequency: 'instant',
    repeatMode: 'repeat',
    isBuiltIn: true,
  },
  {
    id: 'builtin-hodl',
    name: 'HODL Monitor',
    description: 'Long-term holds: significant moves only (±10%, 52W levels)',
    icon: '💎',
    createdAt: 0,
    useCount: 0,
    conditions: [
      { type: 'percent_above', offsetPercent: 0.10, label: '+10% above' },
      { type: 'percent_below', offsetPercent: 0.10, label: '-10% below' },
      { type: '52w_high', label: '52-week high' },
      { type: '52w_low', label: '52-week low' },
    ],
    soundType: 'gentle',
    frequency: 'quiet',
    repeatMode: 'persistent',
    isBuiltIn: true,
  },
];

// ─── Store ──────────────────────────────────────────────────────

interface TemplateState {
  /** User-created templates */
  templates: AlertTemplate[];
  /** Save a new template from alert config */
  saveTemplate: (template: Omit<AlertTemplate, 'id' | 'createdAt' | 'useCount'>) => string;
  /** Delete a user-created template */
  deleteTemplate: (id: string) => void;
  /** Rename a template */
  renameTemplate: (id: string, name: string) => void;
  /** Record a template usage */
  recordUse: (id: string) => void;
  /** Get all templates (built-in + user) */
  getAllTemplates: () => AlertTemplate[];
}

let _templateId = 0;

export const useAlertTemplates = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (template) => {
        const id = `tmpl-${Date.now()}-${++_templateId}`;
        const full: AlertTemplate = {
          ...template,
          id,
          createdAt: Date.now(),
          useCount: 0,
        };
        set((s) => ({ templates: [full, ...s.templates] }));
        return id;
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      recordUse: (id) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, useCount: t.useCount + 1 } : t,
          ),
        })),

      getAllTemplates: () => [...BUILT_IN_TEMPLATES, ...get().templates],
    }),
    {
      name: 'charEdge-alert-templates', version: 1,
    },
  ),
);

// ─── Template Application Helper ────────────────────────────────

/**
 * Apply a template to a symbol and return the alert configs to create.
 */
export function applyTemplate(
  template: AlertTemplate,
  symbol: string,
  currentPrice: number,
): {
  symbol: string;
  condition: string;
  price: number;
  soundType: string;
  repeatMode: string;
}[] {
  useAlertTemplates.getState().recordUse(template.id);

  return template.conditions.map((cond) => {
    let price = currentPrice;

    if (cond.absolutePrice) {
      price = cond.absolutePrice;
    } else if (cond.offsetPercent != null) {
      if (cond.type.includes('above')) {
        price = Math.round(currentPrice * (1 + cond.offsetPercent) * 100) / 100;
      } else {
        price = Math.round(currentPrice * (1 - cond.offsetPercent) * 100) / 100;
      }
    }

    return {
      symbol,
      condition: cond.type,
      price,
      soundType: template.soundType,
      repeatMode: template.repeatMode,
    };
  });
}

/**
 * Create a template from an existing alert.
 */
export function templateFromAlert(alert: {
  condition: string;
  price: number;
  currentPrice?: number;
  soundEnabled?: boolean;
  repeatMode?: string;
}, name: string): string {
  const refPrice = alert.currentPrice || alert.price;
  const offsetPercent = refPrice ? Math.abs((alert.price - refPrice) / refPrice) : 0;

  return useAlertTemplates.getState().saveTemplate({
    name,
    description: `Template from ${alert.condition} alert`,
    icon: '📋',
    conditions: [{
      type: alert.condition,
      offsetPercent: offsetPercent || undefined,
      absolutePrice: !offsetPercent ? alert.price : undefined,
      label: `${alert.condition} ${offsetPercent ? `±${(offsetPercent * 100).toFixed(1)}%` : `$${alert.price}`}`,
    }],
    soundType: alert.soundEnabled ? 'price' : 'silent',
    frequency: 'balanced',
    repeatMode: alert.repeatMode || 'once',
  });
}

export default useAlertTemplates;
