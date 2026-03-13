// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Controls (Shared Library)
// Consolidates duplicated form controls from ChartSettingsPanel,
// IndicatorSettingsDialog, and DrawingEditPopup into one source.
// ═══════════════════════════════════════════════════════════════════

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

// ─── Checkbox Row (TradingView-style) ───────────────────────────
// Rounded-square checkbox with label. Used for Middle point, Price labels, etc.

export function CheckboxRow({ label, checked, onChange, disabled }) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                fontSize: 13,
                fontFamily: F,
                color: disabled ? C.t3 : C.t1,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'opacity 0.15s ease',
            }}
        >
            <button
                onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!checked); }}
                disabled={disabled}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1.5px solid ${checked ? C.b : C.bd}`,
                    background: checked ? C.b : 'transparent',
                    cursor: disabled ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    padding: 0,
                }}
            >
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
            <span style={{ flex: 1 }}>{label}</span>
        </label>
    );
}

// ─── Line Compound Control ──────────────────────────────────────
// Inline: color swatch + line width/style preview. TradingView's "Line" row.

const LINE_DASH_OPTIONS = [
    { id: 'solid', label: '──', value: [] },
    { id: 'dashed', label: '- -', value: [6, 4] },
    { id: 'dotted', label: '· ·', value: [2, 3] },
    { id: 'dashdot', label: '-·-', value: [8, 4, 2, 4] },
];

export function LineCompound({ label, color, onColorChange, lineWidth, onWidthChange, dash, onDashChange }) {
    return (
        <div style={{ padding: '6px 0' }}>
            {label && (
                <div style={{ fontSize: 13, fontFamily: F, color: C.t1, marginBottom: 8 }}>{label}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Color swatch */}
                <div style={{ position: 'relative', width: 32, height: 32 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: color || '#2962FF',
                            border: `1px solid ${C.bd}`,
                            cursor: 'pointer',
                        }}
                    />
                    <input
                        type="color"
                        value={color || '#2962FF'}
                        onChange={(e) => onColorChange(e.target.value)}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                        }}
                    />
                </div>
                {/* Line preview (simulated thickness) */}
                <div
                    style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 6,
                        border: `1px solid ${C.bd}`,
                        background: C.sf,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 10px',
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            height: Math.max(1, lineWidth || 2),
                            background: color || '#2962FF',
                            borderRadius: 1,
                        }}
                    />
                </div>
                {/* Dash selector buttons */}
                {onDashChange && (
                    <div style={{ display: 'flex', gap: 2 }}>
                        {LINE_DASH_OPTIONS.map((dp) => {
                            const isActive = JSON.stringify(dash || []) === JSON.stringify(dp.value);
                            return (
                                <button
                                    key={dp.id}
                                    onClick={() => onDashChange(dp.value)}
                                    title={dp.id}
                                    style={{
                                        padding: '5px 6px',
                                        borderRadius: 5,
                                        border: `1px solid ${isActive ? C.b + '60' : 'transparent'}`,
                                        background: isActive ? C.b + '15' : 'transparent',
                                        color: isActive ? C.b : C.t3,
                                        fontFamily: M,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        transition: 'all 0.12s ease',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {dp.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Width slider */}
            {onWidthChange && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={lineWidth || 2}
                        onChange={(e) => onWidthChange(parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: C.b, height: 4 }}
                    />
                    <span style={{ fontSize: 10, color: C.t3, fontFamily: M, minWidth: 14, textAlign: 'right' }}>
                        {lineWidth || 2}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Line End Picker ────────────────────────────────────────────
// Choose left/right end styles: none, circle (open), arrow.

const LINE_END_OPTIONS = [
    { id: 'none', label: '—' },
    { id: 'circle', label: '○—' },
    { id: 'arrow', label: '—▸' },
];

export function LineEndPicker({ label, leftEnd, rightEnd, onLeftChange, onRightChange }) {
    return (
        <div style={{ padding: '6px 0' }}>
            {label && (
                <div style={{ fontSize: 13, fontFamily: F, color: C.t1, marginBottom: 6 }}>{label}</div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
                {/* Left end */}
                <div style={{ display: 'flex', gap: 2 }}>
                    {LINE_END_OPTIONS.map((opt) => {
                        const isActive = (leftEnd || 'none') === opt.id;
                        return (
                            <button
                                key={`l-${opt.id}`}
                                onClick={() => onLeftChange(opt.id)}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: 5,
                                    border: `1px solid ${isActive ? C.b + '60' : C.bd}`,
                                    background: isActive ? C.b + '15' : 'transparent',
                                    color: isActive ? C.b : C.t3,
                                    fontSize: 12,
                                    fontFamily: M,
                                    cursor: 'pointer',
                                    transition: 'all 0.12s ease',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
                {/* Right end */}
                <div style={{ display: 'flex', gap: 2 }}>
                    {LINE_END_OPTIONS.map((opt) => {
                        const isActive = (rightEnd || 'none') === opt.id;
                        return (
                            <button
                                key={`r-${opt.id}`}
                                onClick={() => onRightChange(opt.id)}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: 5,
                                    border: `1px solid ${isActive ? C.b + '60' : C.bd}`,
                                    background: isActive ? C.b + '15' : 'transparent',
                                    color: isActive ? C.b : C.t3,
                                    fontSize: 12,
                                    fontFamily: M,
                                    cursor: 'pointer',
                                    transition: 'all 0.12s ease',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Font Toolbar ───────────────────────────────────────────────
// Color swatch + font size dropdown + Bold + Italic buttons.

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export function FontToolbar({ color, onColorChange, fontSize, onSizeChange, bold, onBoldChange, italic, onItalicChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
            {/* Color swatch */}
            <div style={{ position: 'relative', width: 32, height: 32 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: color || '#D1D4DC',
                        border: `1px solid ${C.bd}`,
                        cursor: 'pointer',
                    }}
                />
                <input
                    type="color"
                    value={color || '#D1D4DC'}
                    onChange={(e) => onColorChange(e.target.value)}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                    }}
                />
            </div>
            {/* Font size dropdown */}
            <select
                value={fontSize || 14}
                onChange={(e) => onSizeChange(parseInt(e.target.value))}
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
                    minWidth: 56,
                }}
            >
                {FONT_SIZES.map((s) => (
                    <option key={s} value={s} style={{ background: C.sf, color: C.t1 }}>{s}</option>
                ))}
            </select>
            {/* Bold */}
            <button
                onClick={() => onBoldChange(!bold)}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: `1px solid ${bold ? C.b + '60' : C.bd}`,
                    background: bold ? C.b + '15' : 'transparent',
                    color: bold ? C.b : C.t2,
                    fontWeight: 800,
                    fontSize: 14,
                    fontFamily: F,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                B
            </button>
            {/* Italic */}
            <button
                onClick={() => onItalicChange(!italic)}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: `1px solid ${italic ? C.b + '60' : C.bd}`,
                    background: italic ? C.b + '15' : 'transparent',
                    color: italic ? C.b : C.t2,
                    fontStyle: 'italic',
                    fontSize: 14,
                    fontFamily: F,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                I
            </button>
        </div>
    );
}

// ─── Styled Text Area ───────────────────────────────────────────
// Multiline text input with TradingView-style blue focus ring.

export function StyledTextArea({ value, onChange, placeholder, rows }) {
    return (
        <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Add text'}
            rows={rows || 4}
            style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1.5px solid ${C.bd}`,
                background: C.sf,
                color: C.t1,
                fontFamily: F,
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxSizing: 'border-box',
                minHeight: 80,
            }}
            onFocus={(e) => {
                e.target.style.borderColor = C.b;
                e.target.style.boxShadow = `0 0 0 2px ${C.b}30`;
            }}
            onBlur={(e) => {
                e.target.style.borderColor = C.bd;
                e.target.style.boxShadow = 'none';
            }}
        />
    );
}

// ─── Text Alignment Picker ──────────────────────────────────────
// Two-dropdown row: vertical (Top/Center/Bottom) + horizontal (Left/Center/Right).

const V_ALIGN_OPTIONS = [
    { id: 'top', label: 'Top' },
    { id: 'center', label: 'Center' },
    { id: 'bottom', label: 'Bottom' },
];
const H_ALIGN_OPTIONS = [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Center' },
    { id: 'right', label: 'Right' },
];

export function TextAlignmentPicker({ label, vAlign, hAlign, onVChange, onHChange }) {
    const selectStyle = {
        padding: '5px 8px',
        borderRadius: 6,
        border: `1px solid ${C.bd}`,
        background: C.sf,
        color: C.t1,
        fontFamily: F,
        fontSize: 12,
        outline: 'none',
        cursor: 'pointer',
        flex: 1,
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ fontSize: 13, fontFamily: F, color: C.t1, minWidth: 90 }}>
                {label || 'Text alignment'}
            </span>
            <select value={vAlign || 'top'} onChange={(e) => onVChange(e.target.value)} style={selectStyle}>
                {V_ALIGN_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id} style={{ background: C.sf, color: C.t1 }}>{o.label}</option>
                ))}
            </select>
            <select value={hAlign || 'center'} onChange={(e) => onHChange(e.target.value)} style={selectStyle}>
                {H_ALIGN_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id} style={{ background: C.sf, color: C.t1 }}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

// ─── Stepper Input ──────────────────────────────────────────────
// Number input with up/down stepper arrows — TradingView coordinates style.

export function StepperInput({ label, value, onChange, step, min, max, suffix }) {
    const handleIncrement = () => {
        const s = step || 1;
        const next = Math.min(max ?? Infinity, (value || 0) + s);
        onChange(next);
    };
    const handleDecrement = () => {
        const s = step || 1;
        const next = Math.max(min ?? -Infinity, (value || 0) - s);
        onChange(next);
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {label && (
                <span style={{ fontSize: 12, fontFamily: F, color: C.t2, whiteSpace: 'nowrap' }}>{label}</span>
            )}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 6,
                    border: `1px solid ${C.bd}`,
                    background: C.sf,
                    overflow: 'hidden',
                    flex: 1,
                    transition: 'border-color 0.15s ease',
                }}
            >
                <input
                    type="number"
                    value={typeof value === 'number' ? (value >= 1000 ? value.toFixed(1) : value.toFixed(2)) : value}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) onChange(v);
                    }}
                    step={step || 1}
                    min={min}
                    max={max}
                    style={{
                        flex: 1,
                        padding: '6px 8px',
                        border: 'none',
                        background: 'transparent',
                        color: C.t1,
                        fontFamily: M,
                        fontSize: 12,
                        outline: 'none',
                        minWidth: 0,
                    }}
                    onFocus={(e) => {
                        e.target.parentElement.style.borderColor = C.b;
                        e.target.parentElement.style.boxShadow = `0 0 0 2px ${C.b}30`;
                    }}
                    onBlur={(e) => {
                        e.target.parentElement.style.borderColor = C.bd;
                        e.target.parentElement.style.boxShadow = 'none';
                    }}
                />
                {suffix && (
                    <span style={{ fontSize: 10, color: C.t3, paddingRight: 4 }}>{suffix}</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.bd}` }}>
                    <button
                        onClick={handleIncrement}
                        style={{
                            width: 20,
                            height: 14,
                            border: 'none',
                            borderBottom: `1px solid ${C.bd}`,
                            background: 'transparent',
                            color: C.t3,
                            fontSize: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.b + '15'; e.currentTarget.style.color = C.b; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t3; }}
                    >
                        ▲
                    </button>
                    <button
                        onClick={handleDecrement}
                        style={{
                            width: 20,
                            height: 14,
                            border: 'none',
                            background: 'transparent',
                            color: C.t3,
                            fontSize: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.b + '15'; e.currentTarget.style.color = C.b; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t3; }}
                    >
                        ▼
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Timeframe Visibility Row ───────────────────────────────────
// Per-timeframe row: checkbox + label + min input + range slider + max input.

export function TimeframeVisibilityRow({ label, enabled, onToggle, min, max, rangeMin, rangeMax, onRangeChange, disabled }) {
    const isDisabled = disabled || !enabled;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 0',
                opacity: isDisabled ? 0.4 : 1,
                transition: 'opacity 0.15s ease',
            }}
        >
            {/* Checkbox */}
            <button
                onClick={() => onToggle(!enabled)}
                disabled={disabled}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1.5px solid ${enabled ? C.b : C.bd}`,
                    background: enabled ? C.b : 'transparent',
                    cursor: disabled ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    padding: 0,
                }}
            >
                {enabled && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
            {/* Label */}
            <span style={{ fontSize: 12, fontFamily: F, color: C.t1, minWidth: 56, flexShrink: 0 }}>
                {label}
            </span>
            {/* Min input */}
            <input
                type="number"
                value={rangeMin ?? min}
                onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) onRangeChange(v, rangeMax ?? max);
                }}
                disabled={isDisabled}
                min={min}
                max={max}
                style={{
                    width: 44,
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: `1px solid ${C.bd}`,
                    background: isDisabled ? 'transparent' : C.sf,
                    color: C.t1,
                    fontFamily: M,
                    fontSize: 11,
                    textAlign: 'center',
                    outline: 'none',
                }}
            />
            {/* Range slider */}
            <input
                type="range"
                min={min}
                max={max}
                value={rangeMax ?? max}
                onChange={(e) => onRangeChange(rangeMin ?? min, parseInt(e.target.value))}
                disabled={isDisabled}
                style={{
                    flex: 1,
                    height: 4,
                    accentColor: C.b,
                    cursor: isDisabled ? 'default' : 'pointer',
                }}
            />
            {/* Max input */}
            <input
                type="number"
                value={rangeMax ?? max}
                onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) onRangeChange(rangeMin ?? min, v);
                }}
                disabled={isDisabled}
                min={min}
                max={max}
                style={{
                    width: 44,
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: `1px solid ${C.bd}`,
                    background: isDisabled ? 'transparent' : C.sf,
                    color: C.t1,
                    fontFamily: M,
                    fontSize: 11,
                    textAlign: 'center',
                    outline: 'none',
                }}
            />
        </div>
    );
}
