// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Tool Registry (Single Source of Truth)
//
// Canonical registry for ALL drawing tool metadata:
//   - id, label, category, tier, shortcut, point count
//   - SVG icon components (14×14 viewBox)
//   - Tool groups with group icons
//
// Every UI surface imports from here. No more duplication.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────

export type ToolTier = 'essential' | 'common' | 'advanced';

export type ToolCategory =
  | 'lines'
  | 'fib'
  | 'channels'
  | 'gann'
  | 'shapes'
  | 'text'
  | 'measure'
  | 'trading'
  | 'patterns';

export interface ToolDef {
  id: string;
  label: string;
  category: ToolCategory;
  tier: ToolTier;
  points: number;
  shortcut?: string;
}

export interface ToolGroup {
  id: ToolCategory;
  label: string;
  tools: { id: string; name: string; shortcut?: string }[];
}

// ─── SVG Icon Helpers ────────────────────────────────────────────

const S = 14;
const DI = ({ children }: { children: React.ReactNode }) =>
  React.createElement('svg', { width: S, height: S, viewBox: '0 0 14 14', fill: 'none', style: { display: 'block' } }, children);

// ─── Tool Icons ──────────────────────────────────────────────────

export const TOOL_ICONS: Record<string, React.ReactNode> = {
  // ── Lines ──
  trendline: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 2, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    React.createElement('circle', { cx: 2, cy: 12, r: 1.2, fill: 'currentColor', opacity: 0.5 }),
    React.createElement('circle', { cx: 12, cy: 2, r: 1.2, fill: 'currentColor', opacity: 0.5 }),
  ),
  hline: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 7, x2: 13, y2: 7, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    React.createElement('line', { x1: 3, y1: 5, x2: 3, y2: 9, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
    React.createElement('line', { x1: 11, y1: 5, x2: 11, y2: 9, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
  ),
  vline: React.createElement(DI, null,
    React.createElement('line', { x1: 7, y1: 1, x2: 7, y2: 13, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
  ),
  hray: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 7, x2: 13, y2: 7, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    React.createElement('polygon', { points: '12,5.5 13,7 12,8.5', fill: 'currentColor', opacity: 0.6 }),
  ),
  ray: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 10, x2: 12, y2: 4, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    React.createElement('polygon', { points: '12,4 9,3.5 9.5,6.5', fill: 'currentColor', opacity: 0.7 }),
  ),
  extendedline: React.createElement(DI, null,
    React.createElement('line', { x1: 0, y1: 11, x2: 14, y2: 3, stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
    React.createElement('circle', { cx: 4, cy: 9.5, r: 1, fill: 'currentColor', opacity: 0.5 }),
    React.createElement('circle', { cx: 10, cy: 5, r: 1, fill: 'currentColor', opacity: 0.5 }),
  ),
  crossline: React.createElement(DI, null,
    React.createElement('line', { x1: 7, y1: 1, x2: 7, y2: 13, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 1, y1: 7, x2: 13, y2: 7, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
  ),
  arrow: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 12, x2: 11, y2: 3, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    React.createElement('polyline', { points: '7,2.5 11,3 10.5,7', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
  ),
  infoline: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 10, x2: 12, y2: 4, stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
    React.createElement('rect', { x: 5, y: 5, width: 4, height: 2.5, rx: 0.5, fill: 'currentColor', opacity: 0.15, stroke: 'currentColor', strokeWidth: 0.5 }),
  ),
  polyline: React.createElement(DI, null,
    React.createElement('polyline', { points: '2,11 5,4 8,9 11,3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
  ),

  // ── Fibonacci ──
  fib: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 2, x2: 13, y2: 2, stroke: 'currentColor', strokeWidth: 1, opacity: 0.7 }),
    React.createElement('line', { x1: 1, y1: 5.5, x2: 13, y2: 5.5, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '2 1.5', opacity: 0.5 }),
    React.createElement('line', { x1: 1, y1: 9, x2: 13, y2: 9, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '2 1.5', opacity: 0.5 }),
    React.createElement('line', { x1: 1, y1: 12, x2: 13, y2: 12, stroke: 'currentColor', strokeWidth: 1, opacity: 0.7 }),
  ),
  fibext: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 2, x2: 13, y2: 2, stroke: 'currentColor', strokeWidth: 1, opacity: 0.7 }),
    React.createElement('line', { x1: 1, y1: 5, x2: 13, y2: 5, stroke: 'currentColor', strokeWidth: 0.7, strokeDasharray: '1.5 1.5', opacity: 0.4 }),
    React.createElement('line', { x1: 1, y1: 8, x2: 13, y2: 8, stroke: 'currentColor', strokeWidth: 0.7, strokeDasharray: '1.5 1.5', opacity: 0.4 }),
    React.createElement('line', { x1: 1, y1: 11, x2: 13, y2: 11, stroke: 'currentColor', strokeWidth: 0.7, strokeDasharray: '1.5 1.5', opacity: 0.4 }),
    React.createElement('line', { x1: 12, y1: 2, x2: 12, y2: 11, stroke: 'currentColor', strokeWidth: 0.6, opacity: 0.3 }),
  ),
  fibtimezone: React.createElement(DI, null,
    React.createElement('line', { x1: 3, y1: 1, x2: 3, y2: 13, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.5 }),
    React.createElement('line', { x1: 6, y1: 1, x2: 6, y2: 13, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
    React.createElement('line', { x1: 10, y1: 1, x2: 10, y2: 13, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.3 }),
  ),
  fibarc: React.createElement(DI, null,
    React.createElement('path', { d: 'M2,12 Q7,2 12,12', stroke: 'currentColor', strokeWidth: 1.1, fill: 'none', opacity: 0.7 }),
    React.createElement('path', { d: 'M4,12 Q7,5 10,12', stroke: 'currentColor', strokeWidth: 0.8, fill: 'none', opacity: 0.4 }),
  ),
  fibfan: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 2, stroke: 'currentColor', strokeWidth: 1, opacity: 0.7 }),
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 5, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 8, stroke: 'currentColor', strokeWidth: 0.7, opacity: 0.3 }),
  ),
  fibchannel: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 3, x2: 12, y2: 3, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 2, y1: 7, x2: 12, y2: 7, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '2 1', opacity: 0.4 }),
    React.createElement('line', { x1: 2, y1: 11, x2: 12, y2: 11, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
  ),

  // ── Channels ──
  channel: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 4, x2: 13, y2: 2, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 1, y1: 10, x2: 13, y2: 8, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 1, y1: 7, x2: 13, y2: 5, stroke: 'currentColor', strokeWidth: 0.6, strokeDasharray: '2 1.5', opacity: 0.4 }),
  ),
  parallelchannel: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 4, x2: 13, y2: 4, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 1, y1: 10, x2: 13, y2: 10, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('rect', { x: 1, y: 4, width: 12, height: 6, fill: 'currentColor', opacity: 0.05 }),
  ),
  regressionchannel: React.createElement(DI, null,
    React.createElement('line', { x1: 1, y1: 10, x2: 13, y2: 4, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 1, y1: 7, x2: 13, y2: 1, stroke: 'currentColor', strokeWidth: 0.7, strokeDasharray: '2 1', opacity: 0.4 }),
    React.createElement('line', { x1: 1, y1: 13, x2: 13, y2: 7, stroke: 'currentColor', strokeWidth: 0.7, strokeDasharray: '2 1', opacity: 0.4 }),
  ),
  pitchfork: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 7, x2: 12, y2: 3, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 2, y1: 7, x2: 12, y2: 11, stroke: 'currentColor', strokeWidth: 1.1 }),
    React.createElement('line', { x1: 2, y1: 7, x2: 12, y2: 7, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '2 1', opacity: 0.5 }),
  ),

  // ── Gann ──
  gannfan: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 2, stroke: 'currentColor', strokeWidth: 1 }),
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 7, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.5 }),
    React.createElement('line', { x1: 2, y1: 12, x2: 7, y2: 2, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.5 }),
  ),
  gannsquare: React.createElement(DI, null,
    React.createElement('rect', { x: 2, y: 2, width: 10, height: 10, stroke: 'currentColor', strokeWidth: 1 }),
    React.createElement('line', { x1: 2, y1: 7, x2: 12, y2: 7, stroke: 'currentColor', strokeWidth: 0.6, opacity: 0.3 }),
    React.createElement('line', { x1: 7, y1: 2, x2: 7, y2: 12, stroke: 'currentColor', strokeWidth: 0.6, opacity: 0.3 }),
  ),

  // ── Shapes ──
  rect: React.createElement(DI, null,
    React.createElement('rect', { x: 2, y: 3, width: 10, height: 8, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' }),
  ),
  ellipse: React.createElement(DI, null,
    React.createElement('ellipse', { cx: 7, cy: 7, rx: 5.5, ry: 4, stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' }),
  ),
  triangle: React.createElement(DI, null,
    React.createElement('polygon', { points: '7,2 12,12 2,12', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round', fill: 'none' }),
  ),

  // ── Text & Annotations ──
  text: React.createElement(DI, null,
    React.createElement('text', { x: 3, y: 11, fontSize: 11, fontWeight: 700, fontFamily: 'serif', fill: 'currentColor' }, 'T'),
  ),
  callout: React.createElement(DI, null,
    React.createElement('rect', { x: 1.5, y: 2, width: 11, height: 7.5, rx: 2, stroke: 'currentColor', strokeWidth: 1.1, fill: 'none' }),
    React.createElement('polygon', { points: '4,9.5 6,12 8,9.5', fill: 'currentColor', opacity: 0.6 }),
  ),
  note: React.createElement(DI, null,
    React.createElement('rect', { x: 2, y: 2, width: 10, height: 10, rx: 1, fill: 'currentColor', opacity: 0.08, stroke: 'currentColor', strokeWidth: 0.8 }),
    React.createElement('line', { x1: 4, y1: 5, x2: 10, y2: 5, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.5 }),
    React.createElement('line', { x1: 4, y1: 7.5, x2: 9, y2: 7.5, stroke: 'currentColor', strokeWidth: 0.8, opacity: 0.4 }),
  ),
  signpost: React.createElement(DI, null,
    React.createElement('line', { x1: 7, y1: 5, x2: 7, y2: 13, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('polygon', { points: '3,2 11,2 11,5 7,7 3,5', stroke: 'currentColor', strokeWidth: 1, fill: 'currentColor', fillOpacity: 0.1 }),
  ),
  emoji: React.createElement(DI, null,
    React.createElement('circle', { cx: 7, cy: 7, r: 5, stroke: 'currentColor', strokeWidth: 1, fill: 'none' }),
    React.createElement('circle', { cx: 5, cy: 6, r: 0.8, fill: 'currentColor' }),
    React.createElement('circle', { cx: 9, cy: 6, r: 0.8, fill: 'currentColor' }),
    React.createElement('path', { d: 'M4.5,9 Q7,11 9.5,9', stroke: 'currentColor', strokeWidth: 0.8, fill: 'none' }),
  ),

  // ── Measurement ──
  measure: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 2, stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '2 1.5', opacity: 0.6 }),
    React.createElement('line', { x1: 2, y1: 12, x2: 12, y2: 12, stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
    React.createElement('line', { x1: 12, y1: 2, x2: 12, y2: 12, stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
  ),
  pricerange: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 3, x2: 12, y2: 3, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 2, y1: 11, x2: 12, y2: 11, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 7, y1: 3, x2: 7, y2: 11, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '1.5 1', opacity: 0.4 }),
    React.createElement('polygon', { points: '6,4.5 7,3 8,4.5', fill: 'currentColor', opacity: 0.5 }),
    React.createElement('polygon', { points: '6,9.5 7,11 8,9.5', fill: 'currentColor', opacity: 0.5 }),
  ),
  daterange: React.createElement(DI, null,
    React.createElement('line', { x1: 3, y1: 2, x2: 3, y2: 12, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 11, y1: 2, x2: 11, y2: 12, stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 }),
    React.createElement('line', { x1: 3, y1: 7, x2: 11, y2: 7, stroke: 'currentColor', strokeWidth: 0.8, strokeDasharray: '1.5 1', opacity: 0.4 }),
  ),

  // ── Trading ──
  alertzone: React.createElement(DI, null,
    React.createElement('rect', { x: 2, y: 4, width: 10, height: 6, rx: 1, stroke: 'currentColor', strokeWidth: 1, fill: 'currentColor', fillOpacity: 0.08 }),
    React.createElement('line', { x1: 7, y1: 6, x2: 7, y2: 8.5, stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
    React.createElement('circle', { cx: 7, cy: 9.5, r: 0.5, fill: 'currentColor' }),
  ),
  longposition: React.createElement(DI, null,
    React.createElement('rect', { x: 3, y: 3, width: 8, height: 8, rx: 1, stroke: 'currentColor', strokeWidth: 1, fill: 'currentColor', fillOpacity: 0.06 }),
    React.createElement('polygon', { points: '7,4 9,7 5,7', fill: 'currentColor', opacity: 0.7 }),
    React.createElement('line', { x1: 7, y1: 7, x2: 7, y2: 10, stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
  ),
  shortposition: React.createElement(DI, null,
    React.createElement('rect', { x: 3, y: 3, width: 8, height: 8, rx: 1, stroke: 'currentColor', strokeWidth: 1, fill: 'currentColor', fillOpacity: 0.06 }),
    React.createElement('polygon', { points: '7,10 9,7 5,7', fill: 'currentColor', opacity: 0.7 }),
    React.createElement('line', { x1: 7, y1: 4, x2: 7, y2: 7, stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
  ),
  flattop: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 4, x2: 12, y2: 4, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
    React.createElement('rect', { x: 2, y: 4, width: 10, height: 6, fill: 'currentColor', opacity: 0.06 }),
  ),
  flatbottom: React.createElement(DI, null,
    React.createElement('line', { x1: 2, y1: 10, x2: 12, y2: 10, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
    React.createElement('rect', { x: 2, y: 4, width: 10, height: 6, fill: 'currentColor', opacity: 0.06 }),
  ),

  // ── Patterns ──
  elliott: React.createElement(DI, null,
    React.createElement('polyline', { points: '1,10 3,4 5,8 8,2 10,6 13,10', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
  ),
  xabcd: React.createElement(DI, null,
    React.createElement('polyline', { points: '1,8 4,3 7,9 10,5 13,11', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
  ),
  headshoulders: React.createElement(DI, null,
    React.createElement('polyline', { points: '1,10 3,6 5,10 7,3 9,10 11,6 13,10', stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
  ),
};

// ─── TIcon Helper ────────────────────────────────────────────────

export function TIcon({ id }: { id: string }) {
  return (TOOL_ICONS[id] || React.createElement('span', { style: { fontSize: 13 } }, id[0]?.toUpperCase())) as React.ReactElement;
}

// ─── Tool Definitions ────────────────────────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  // Lines
  { id: 'trendline', label: 'Trend Line', category: 'lines', tier: 'essential', points: 2, shortcut: 'T' },
  { id: 'hline', label: 'Horizontal Line', category: 'lines', tier: 'essential', points: 1, shortcut: 'H' },
  { id: 'vline', label: 'Vertical Line', category: 'lines', tier: 'essential', points: 1, shortcut: 'V' },
  { id: 'hray', label: 'Horizontal Ray', category: 'lines', tier: 'common', points: 1 },
  { id: 'ray', label: 'Ray', category: 'lines', tier: 'common', points: 2 },
  { id: 'extendedline', label: 'Extended Line', category: 'lines', tier: 'common', points: 2 },
  { id: 'crossline', label: 'Crossline', category: 'lines', tier: 'advanced', points: 1 },
  { id: 'arrow', label: 'Arrow', category: 'lines', tier: 'common', points: 2 },
  { id: 'infoline', label: 'Info Line', category: 'lines', tier: 'advanced', points: 2 },
  { id: 'polyline', label: 'Polyline', category: 'lines', tier: 'advanced', points: Infinity },

  // Fibonacci
  { id: 'fib', label: 'Fib Retracement', category: 'fib', tier: 'essential', points: 2, shortcut: 'F' },
  { id: 'fibext', label: 'Fib Extension', category: 'fib', tier: 'common', points: 3 },
  { id: 'fibtimezone', label: 'Fib Time Zone', category: 'fib', tier: 'advanced', points: 2 },
  { id: 'fibarc', label: 'Fib Arc', category: 'fib', tier: 'advanced', points: 2 },
  { id: 'fibfan', label: 'Fib Fan', category: 'fib', tier: 'advanced', points: 2 },
  { id: 'fibchannel', label: 'Fib Channel', category: 'fib', tier: 'advanced', points: 3 },

  // Channels
  { id: 'channel', label: 'Channel', category: 'channels', tier: 'common', points: 3 },
  { id: 'parallelchannel', label: 'Parallel Channel', category: 'channels', tier: 'common', points: 3 },
  { id: 'regressionchannel', label: 'Regression Channel', category: 'channels', tier: 'advanced', points: 2 },
  { id: 'pitchfork', label: 'Pitchfork', category: 'channels', tier: 'advanced', points: 3 },

  // Gann
  { id: 'gannfan', label: 'Gann Fan', category: 'gann', tier: 'advanced', points: 2 },
  { id: 'gannsquare', label: 'Gann Square', category: 'gann', tier: 'advanced', points: 2 },

  // Shapes
  { id: 'rect', label: 'Rectangle', category: 'shapes', tier: 'essential', points: 2, shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', category: 'shapes', tier: 'common', points: 2 },
  { id: 'triangle', label: 'Triangle', category: 'shapes', tier: 'common', points: 3 },

  // Text & Annotations
  { id: 'text', label: 'Text', category: 'text', tier: 'common', points: 1 },
  { id: 'callout', label: 'Callout', category: 'text', tier: 'common', points: 1 },
  { id: 'note', label: 'Note', category: 'text', tier: 'advanced', points: 1 },
  { id: 'signpost', label: 'Signpost', category: 'text', tier: 'advanced', points: 1 },
  { id: 'emoji', label: 'Emoji', category: 'text', tier: 'advanced', points: 1 },

  // Measurement
  { id: 'measure', label: 'Measure', category: 'measure', tier: 'essential', points: 2, shortcut: 'M' },
  { id: 'pricerange', label: 'Price Range', category: 'measure', tier: 'common', points: 2 },
  { id: 'daterange', label: 'Date Range', category: 'measure', tier: 'common', points: 2 },

  // Trading
  { id: 'longposition', label: 'Long Position', category: 'trading', tier: 'common', points: 2 },
  { id: 'shortposition', label: 'Short Position', category: 'trading', tier: 'common', points: 2 },
  { id: 'alertzone', label: 'Alert Zone', category: 'trading', tier: 'common', points: 2 },
  { id: 'flattop', label: 'Flat Top', category: 'trading', tier: 'advanced', points: 2 },
  { id: 'flatbottom', label: 'Flat Bottom', category: 'trading', tier: 'advanced', points: 2 },

  // Patterns
  { id: 'elliott', label: 'Elliott Wave', category: 'patterns', tier: 'advanced', points: 5 },
  { id: 'xabcd', label: 'XABCD Harmonic', category: 'patterns', tier: 'advanced', points: 5 },
  { id: 'headshoulders', label: 'Head & Shoulders', category: 'patterns', tier: 'advanced', points: 7 },
];

// ─── Derived lookups ─────────────────────────────────────────────

/** Flat map of id → label */
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_DEFS.map((t) => [t.id, t.label])
);

/** Flat array for flat lists (compatible with ALL_TOOLS) */
export const ALL_TOOLS: { id: string; name: string }[] = TOOL_DEFS.map((t) => ({
  id: t.id,
  name: t.label,
}));

/** Tool config for backward compat (compatible with drawingTools.js TOOL_CONFIG) */
export const TOOL_CONFIG: Record<string, { label: string; points: number; icon: string }> = Object.fromEntries(
  TOOL_DEFS.map((t) => [t.id, { label: t.label, points: t.points, icon: t.label[0] || '' }])
);

// ─── Tool Groups (for UI categorization) ─────────────────────────

export const DRAWING_GROUPS: ToolGroup[] = [
  {
    id: 'lines',
    label: 'Lines',
    tools: [
      { id: 'trendline', name: 'Trend Line', shortcut: 'T' },
      { id: 'hline', name: 'Horizontal Line', shortcut: 'H' },
      { id: 'hray', name: 'Horizontal Ray' },
      { id: 'vline', name: 'Vertical Line', shortcut: 'V' },
      { id: 'ray', name: 'Ray' },
      { id: 'extendedline', name: 'Extended Line' },
      { id: 'crossline', name: 'Crossline' },
      { id: 'arrow', name: 'Arrow' },
      { id: 'infoline', name: 'Info Line' },
      { id: 'polyline', name: 'Polyline' },
    ],
  },
  {
    id: 'fib',
    label: 'Fibonacci',
    tools: [
      { id: 'fib', name: 'Fib Retracement', shortcut: 'F' },
      { id: 'fibext', name: 'Fib Extension' },
      { id: 'fibtimezone', name: 'Fib Time Zone' },
      { id: 'fibarc', name: 'Fib Arc' },
      { id: 'fibfan', name: 'Fib Fan' },
      { id: 'fibchannel', name: 'Fib Channel' },
    ],
  },
  {
    id: 'channels',
    label: 'Channels',
    tools: [
      { id: 'channel', name: 'Channel' },
      { id: 'parallelchannel', name: 'Parallel Channel' },
      { id: 'regressionchannel', name: 'Regression Channel' },
      { id: 'pitchfork', name: 'Pitchfork' },
    ],
  },
  {
    id: 'gann',
    label: 'Gann',
    tools: [
      { id: 'gannfan', name: 'Gann Fan' },
      { id: 'gannsquare', name: 'Gann Square' },
    ],
  },
  {
    id: 'shapes',
    label: 'Shapes',
    tools: [
      { id: 'rect', name: 'Rectangle', shortcut: 'R' },
      { id: 'ellipse', name: 'Ellipse' },
      { id: 'triangle', name: 'Triangle' },
    ],
  },
  {
    id: 'text',
    label: 'Annotations',
    tools: [
      { id: 'text', name: 'Text' },
      { id: 'callout', name: 'Callout' },
      { id: 'note', name: 'Note' },
      { id: 'signpost', name: 'Signpost' },
      { id: 'emoji', name: 'Emoji' },
    ],
  },
  {
    id: 'measure',
    label: 'Measure',
    tools: [
      { id: 'measure', name: 'Measure', shortcut: 'M' },
      { id: 'pricerange', name: 'Price Range' },
      { id: 'daterange', name: 'Date Range' },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    tools: [
      { id: 'longposition', name: 'Long Position' },
      { id: 'shortposition', name: 'Short Position' },
      { id: 'alertzone', name: 'Alert Zone' },
      { id: 'flattop', name: 'Flat Top' },
      { id: 'flatbottom', name: 'Flat Bottom' },
    ],
  },
  {
    id: 'patterns',
    label: 'Patterns',
    tools: [
      { id: 'elliott', name: 'Elliott Wave' },
      { id: 'xabcd', name: 'XABCD Harmonic' },
      { id: 'headshoulders', name: 'Head & Shoulders' },
    ],
  },
];

// ─── Group Icons (for collapsed group buttons) ───────────────────

export const GROUP_ICONS: Record<string, React.ReactNode> = {
  lines: TOOL_ICONS.trendline,
  fib: TOOL_ICONS.fib,
  channels: TOOL_ICONS.channel,
  gann: TOOL_ICONS.gannfan,
  shapes: TOOL_ICONS.rect,
  text: TOOL_ICONS.text,
  measure: TOOL_ICONS.measure,
  trading: TOOL_ICONS.longposition,
  patterns: TOOL_ICONS.elliott,
};
