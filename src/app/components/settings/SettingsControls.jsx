// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Controls (Shared Library)
// Consolidates duplicated form controls from ChartSettingsPanel,
// IndicatorSettingsDialog, and DrawingEditPopup into one source.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';

// ─── Color Swatch ───────────────────────────────────────────────
// Color picker with preview swatch. Click to open native picker.

export function ColorSwatch({ color, onChange, label }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: F,
                color: C.t1,
                cursor: 'pointer',
            }}
        >
            {label && <span style={{ flex: 1 }}>{label}</span>}
            <div style={{ position: 'relative', width: 28, height: 28 }}>
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: color,
                        border: `1px solid ${C.bd}`,
                        cursor: 'pointer',
                    }}
                />
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                    }}
                />
            </div>
        </label>
    );
}

// ─── Toggle Switch ──────────────────────────────────────────────
// Animated on/off toggle with optional label.

export function Toggle({ label, checked, onChange }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: F,
                color: C.t1,
                cursor: 'pointer',
            }}
        >
            <span style={{ flex: 1 }}>{label}</span>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    border: 'none',
                    padding: 2,
                    background: checked ? C.b : C.bd,
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'transform 0.2s ease',
                        transform: checked ? 'translateX(16px)' : 'translateX(0)',
                    }}
                />
            </button>
        </label>
    );
}

// ─── Range Slider ───────────────────────────────────────────────
// Combined range + number input with optional display override.

export function RangeSlider({ label, value, min, max, step, onChange, display }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: F,
                color: C.t1,
            }}
        >
            <span style={{ flex: 1, minWidth: 80 }}>{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: 90, accentColor: C.b }}
            />
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={display !== undefined ? display : value}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
                }}
                style={{
                    width: 48,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: `1px solid ${C.bd}`,
                    background: C.sf,
                    color: C.t1,
                    fontFamily: M,
                    fontSize: 11,
                    textAlign: 'right',
                    outline: 'none',
                }}
            />
        </label>
    );
}

// ─── Number Input ───────────────────────────────────────────────
// Standalone number stepper with label.

export function NumberInput({ label, value, min, max, step, onChange }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: F,
                color: C.t1,
            }}
        >
            <span style={{ flex: 1 }}>{label}</span>
            <input
                type="number"
                min={min}
                max={max}
                step={step ?? 1}
                value={value}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)));
                }}
                style={{
                    width: 64,
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: `1px solid ${C.bd}`,
                    background: C.sf,
                    color: C.t1,
                    fontFamily: M,
                    fontSize: 12,
                    textAlign: 'right',
                    outline: 'none',
                }}
            />
        </label>
    );
}

// ─── Select Dropdown ────────────────────────────────────────────
// Themed <select> for source, smoothing type, etc.

export function SelectDropdown({ label, value, options, onChange }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                fontSize: 13,
                fontFamily: F,
                color: C.t1,
            }}
        >
            <span style={{ flex: 1 }}>{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: `1px solid ${C.bd}`,
                    background: C.sf,
                    color: C.t1,
                    fontFamily: F,
                    fontSize: 12,
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: 100,
                }}
            >
                {options.map((opt) => {
                    const id = typeof opt === 'string' ? opt : opt.id;
                    const lbl = typeof opt === 'string' ? opt : opt.label;
                    return (
                        <option key={id} value={id} style={{ background: C.sf, color: C.t1 }}>
                            {lbl}
                        </option>
                    );
                })}
            </select>
        </label>
    );
}

// ─── Radio Group ────────────────────────────────────────────────
// Segmented button group for mutually exclusive options.

export function RadioGroup({ label, options, value, onChange }) {
    return (
        <div style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 13, fontFamily: F, color: C.t1, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', gap: 4 }}>
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onChange(opt.id)}
                        style={{
                            flex: 1,
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: `1px solid ${value === opt.id ? C.b + '60' : C.bd}`,
                            background: value === opt.id ? C.b + '15' : 'transparent',
                            color: value === opt.id ? C.b : C.t2,
                            fontFamily: F,
                            fontSize: 11,
                            fontWeight: value === opt.id ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Line Style Picker ──────────────────────────────────────────
// Visual solid/dashed/dotted selector.

const LINE_STYLES = [
    { id: 'solid', label: '──', value: [] },
    { id: 'dashed', label: '- -', value: [6, 4] },
    { id: 'dotted', label: '· ·', value: [2, 3] },
];

export function LineStylePicker({ label, value, onChange }) {
    // Determine active id from dash array
    const activeId = !value || value.length === 0 ? 'solid'
        : value[0] > 3 ? 'dashed' : 'dotted';

    return (
        <div style={{ padding: '6px 0' }}>
            {label && (
                <div style={{ fontSize: 13, fontFamily: F, color: C.t1, marginBottom: 6 }}>{label}</div>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
                {LINE_STYLES.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => onChange(s.value)}
                        style={{
                            flex: 1,
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: `1px solid ${activeId === s.id ? C.b + '60' : C.bd}`,
                            background: activeId === s.id ? C.b + '15' : 'transparent',
                            color: activeId === s.id ? C.b : C.t2,
                            fontFamily: M,
                            fontSize: 13,
                            fontWeight: activeId === s.id ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            letterSpacing: 2,
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Section Label ──────────────────────────────────────────────
// Uppercase section header used throughout settings panels.

export function SectionLabel({ children }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.t3,
                fontFamily: F,
                letterSpacing: 0.8,
                marginTop: 16,
                marginBottom: 6,
                textTransform: 'uppercase',
            }}
        >
            {children}
        </div>
    );
}
