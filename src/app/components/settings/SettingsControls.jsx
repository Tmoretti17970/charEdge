// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Controls (Sprint 24: CSS Module Migration)
// Consolidates shared form controls from settings/indicator/drawing
// panels. All styling via CSS module + data-attributes.
// ═══════════════════════════════════════════════════════════════════

import css from './SettingsControls.module.css';

// ─── Color Swatch ───────────────────────────────────────────────

export function ColorSwatch({ color, onChange, label }) {
    return (
        <label className={css.controlRowPointer}>
            {label && <span className={css.flex1}>{label}</span>}
            <div className={css.swatchWrap}>
                <div className={css.swatchPreview} style={{ background: color }} />
                <input type="color" value={color} onChange={(e) => onChange(e.target.value)}
                    className={css.swatchInput} />
            </div>
        </label>
    );
}

// ─── Toggle Switch ──────────────────────────────────────────────

export function Toggle({ label, checked, onChange }) {
    return (
        <label className={css.controlRowPointer}>
            <span className={css.flex1}>{label}</span>
            <button onClick={() => onChange(!checked)} className={css.toggleTrack}
                data-checked={checked ? 'true' : undefined}>
                <div className={css.toggleThumb} />
            </button>
        </label>
    );
}

// ─── Range Slider ───────────────────────────────────────────────

export function RangeSlider({ label, value, min, max, step, onChange, display }) {
    return (
        <label className={css.controlRow}>
            <span className={css.flex1Min}>{label}</span>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={css.rangeInput} />
            <input type="number" min={min} max={max} step={step}
                value={display !== undefined ? display : value}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
                }}
                className={css.numInputSm} />
        </label>
    );
}

// ─── Number Input ───────────────────────────────────────────────

export function NumberInput({ label, value, min, max, step, onChange }) {
    return (
        <label className={css.controlRow}>
            <span className={css.flex1}>{label}</span>
            <input type="number" min={min} max={max} step={step ?? 1} value={value}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)));
                }}
                className={css.numInput} />
        </label>
    );
}

// ─── Select Dropdown ────────────────────────────────────────────

export function SelectDropdown({ label, value, options, onChange }) {
    return (
        <label className={css.controlRow}>
            <span className={css.flex1}>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className={css.selectInput}>
                {options.map((opt) => {
                    const id = typeof opt === 'string' ? opt : opt.id;
                    const lbl = typeof opt === 'string' ? opt : opt.label;
                    return <option key={id} value={id}>{lbl}</option>;
                })}
            </select>
        </label>
    );
}

// ─── Radio Group ────────────────────────────────────────────────

export function RadioGroup({ label, options, value, onChange }) {
    return (
        <div className={css.segmentPad}>
            <div className={css.segmentLabel}>{label}</div>
            <div className={css.segmentRow}>
                {options.map((opt) => (
                    <button key={opt.id} onClick={() => onChange(opt.id)}
                        className={css.segmentBtn}
                        data-active={value === opt.id ? 'true' : undefined}>
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Line Style Picker ──────────────────────────────────────────

const LINE_STYLES = [
    { id: 'solid', label: '──', value: [] },
    { id: 'dashed', label: '- -', value: [6, 4] },
    { id: 'dotted', label: '· ·', value: [2, 3] },
];

export function LineStylePicker({ label, value, onChange }) {
    const activeId = !value || value.length === 0 ? 'solid'
        : value[0] > 3 ? 'dashed' : 'dotted';
    return (
        <div className={css.segmentPad}>
            {label && <div className={css.segmentLabel}>{label}</div>}
            <div className={css.segmentRow}>
                {LINE_STYLES.map((s) => (
                    <button key={s.id} onClick={() => onChange(s.value)}
                        className={css.lineStyleBtn}
                        data-active={activeId === s.id ? 'true' : undefined}>
                        {s.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Section Label ──────────────────────────────────────────────

export function SectionLabel({ children }) {
    return <div className={css.sectionLabel}>{children}</div>;
}

// ─── Checkbox Row ───────────────────────────────────────────────

export function CheckboxRow({ label, checked, onChange, disabled }) {
    return (
        <label className={css.checkRow} data-disabled={disabled ? 'true' : undefined}>
            <button onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!checked); }}
                disabled={disabled} className={css.checkBox}
                data-checked={checked ? 'true' : undefined}
                data-disabled={disabled ? 'true' : undefined}>
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
            <span className={css.flex1}>{label}</span>
        </label>
    );
}

// ─── Line Compound Control ──────────────────────────────────────

const LINE_DASH_OPTIONS = [
    { id: 'solid', label: '──', value: [] },
    { id: 'dashed', label: '- -', value: [6, 4] },
    { id: 'dotted', label: '· ·', value: [2, 3] },
    { id: 'dashdot', label: '-·-', value: [8, 4, 2, 4] },
];

export function LineCompound({ label, color, onColorChange, lineWidth, onWidthChange, dash, onDashChange }) {
    return (
        <div className={css.segmentPad}>
            {label && <div className={css.segmentLabel} style={{ marginBottom: 8 }}>{label}</div>}
            <div className={css.controlRow} style={{ gap: 6, padding: 0 }}>
                <div className={css.swatchWrapLg}>
                    <div className={css.swatchPreviewLg} style={{ background: color || '#2962FF' }} />
                    <input type="color" value={color || '#2962FF'}
                        onChange={(e) => onColorChange(e.target.value)}
                        className={css.swatchInputInset} />
                </div>
                <div className={css.linePreviewBox}>
                    <div style={{
                        flex: 1, height: Math.max(1, lineWidth || 2),
                        background: color || '#2962FF', borderRadius: 1,
                    }} />
                </div>
                {onDashChange && (
                    <div className={css.dashBtnRow}>
                        {LINE_DASH_OPTIONS.map((dp) => {
                            const isActive = JSON.stringify(dash || []) === JSON.stringify(dp.value);
                            return (
                                <button key={dp.id} onClick={() => onDashChange(dp.value)}
                                    title={dp.id} className={css.dashBtn}
                                    data-active={isActive ? 'true' : undefined}>
                                    {dp.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            {onWidthChange && (
                <div className={css.widthSliderRow}>
                    <input type="range" min={1} max={5} step={1}
                        value={lineWidth || 2}
                        onChange={(e) => onWidthChange(parseInt(e.target.value))}
                        className={css.widthSlider} />
                    <span className={css.widthValue}>{lineWidth || 2}</span>
                </div>
            )}
        </div>
    );
}

// ─── Line End Picker ────────────────────────────────────────────

const LINE_END_OPTIONS = [
    { id: 'none', label: '—' },
    { id: 'circle', label: '○—' },
    { id: 'arrow', label: '—▸' },
];

export function LineEndPicker({ label, leftEnd, rightEnd, onLeftChange, onRightChange }) {
    return (
        <div className={css.segmentPad}>
            {label && <div className={css.segmentLabel}>{label}</div>}
            <div className={css.endGroup}>
                <div className={css.endBtnRow}>
                    {LINE_END_OPTIONS.map((opt) => (
                        <button key={`l-${opt.id}`} onClick={() => onLeftChange(opt.id)}
                            className={css.endBtn}
                            data-active={(leftEnd || 'none') === opt.id ? 'true' : undefined}>
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className={css.endBtnRow}>
                    {LINE_END_OPTIONS.map((opt) => (
                        <button key={`r-${opt.id}`} onClick={() => onRightChange(opt.id)}
                            className={css.endBtn}
                            data-active={(rightEnd || 'none') === opt.id ? 'true' : undefined}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Font Toolbar ───────────────────────────────────────────────

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export function FontToolbar({ color, onColorChange, fontSize, onSizeChange, bold, onBoldChange, italic, onItalicChange }) {
    return (
        <div className={css.fontToolbarRow}>
            <div className={css.swatchWrapLg}>
                <div className={css.swatchPreviewLg} style={{ background: color || '#D1D4DC' }} />
                <input type="color" value={color || '#D1D4DC'}
                    onChange={(e) => onColorChange(e.target.value)}
                    className={css.swatchInputInset} />
            </div>
            <select value={fontSize || 14}
                onChange={(e) => onSizeChange(parseInt(e.target.value))}
                className={css.fontSizeSelect}>
                {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
            <button onClick={() => onBoldChange(!bold)} className={css.formatBtn}
                data-active={bold ? 'true' : undefined}
                style={{ fontWeight: 800 }}>B</button>
            <button onClick={() => onItalicChange(!italic)} className={css.formatBtn}
                data-active={italic ? 'true' : undefined}
                style={{ fontStyle: 'italic' }}>I</button>
        </div>
    );
}

// ─── Styled Text Area ───────────────────────────────────────────

export function StyledTextArea({ value, onChange, placeholder, rows }) {
    return (
        <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Add text'}
            rows={rows || 4}
            className={css.textArea}
        />
    );
}

// ─── Text Alignment Picker ──────────────────────────────────────

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
    return (
        <div className={css.alignRow}>
            <span className={css.alignLabel}>{label || 'Text alignment'}</span>
            <select value={vAlign || 'top'} onChange={(e) => onVChange(e.target.value)}
                className={css.alignSelect}>
                {V_ALIGN_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
            <select value={hAlign || 'center'} onChange={(e) => onHChange(e.target.value)}
                className={css.alignSelect}>
                {H_ALIGN_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

// ─── Stepper Input ──────────────────────────────────────────────

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
        <div className={css.stepperRow}>
            {label && <span className={css.stepperLabel}>{label}</span>}
            <div className={css.stepperWrap}>
                <input type="number"
                    value={typeof value === 'number' ? (value >= 1000 ? value.toFixed(1) : value.toFixed(2)) : value}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
                    step={step || 1} min={min} max={max}
                    className={css.stepperField} />
                {suffix && <span className={css.stepperSuffix}>{suffix}</span>}
                <div className={css.stepperBtnCol}>
                    <button onClick={handleIncrement} className={css.stepperBtn}>▲</button>
                    <button onClick={handleDecrement} className={css.stepperBtn}>▼</button>
                </div>
            </div>
        </div>
    );
}

// ─── Timeframe Visibility Row ───────────────────────────────────

export function TimeframeVisibilityRow({ label, enabled, onToggle, min, max, rangeMin, rangeMax, onRangeChange, disabled }) {
    const isDisabled = disabled || !enabled;
    return (
        <div className={css.tfVisRow} data-disabled={isDisabled ? 'true' : undefined}>
            <button onClick={() => onToggle(!enabled)} disabled={disabled}
                className={css.checkBox}
                data-checked={enabled ? 'true' : undefined}
                data-disabled={disabled ? 'true' : undefined}>
                {enabled && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
            <span className={css.tfLabel}>{label}</span>
            <input type="number" value={rangeMin ?? min}
                onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) onRangeChange(v, rangeMax ?? max); }}
                disabled={isDisabled} min={min} max={max}
                className={css.tfNumInput}
                data-disabled={isDisabled ? 'true' : undefined} />
            <input type="range" min={min} max={max} value={rangeMax ?? max}
                onChange={(e) => onRangeChange(rangeMin ?? min, parseInt(e.target.value))}
                disabled={isDisabled} className={css.tfRange}
                data-disabled={isDisabled ? 'true' : undefined} />
            <input type="number" value={rangeMax ?? max}
                onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) onRangeChange(rangeMin ?? min, v); }}
                disabled={isDisabled} min={min} max={max}
                className={css.tfNumInput}
                data-disabled={isDisabled ? 'true' : undefined} />
        </div>
    );
}
