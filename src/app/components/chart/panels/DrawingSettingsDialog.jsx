// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Settings Dialog (Batch 15)
// Full 3-tab dialog for complex drawing tools: Style / Coordinates / Visibility.
// Opened via gear icon in DrawingEditPopup or charEdge:open-drawing-settings event.
// Uses SettingsTabShell for layout and SettingsControls for form controls.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { C, F, M } from '../../../../constants.js';
import {
    ColorSwatch,
    Toggle,
    RangeSlider,
    SelectDropdown,
    LineStylePicker,
    SectionLabel,
} from '../../settings/SettingsControls.jsx';
import SettingsTabShell from '../../settings/SettingsTabShell.jsx';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';

// ─── Constants ──────────────────────────────────────────────────

const TABS = [
    { id: 'style', label: 'Style' },
    { id: 'coordinates', label: 'Coordinates' },
    { id: 'visibility', label: 'Visibility' },
];

const TIMEFRAMES = [
    { id: 'sec', label: 'Sec' },
    { id: 'min', label: 'Min' },
    { id: 'hr', label: 'Hr' },
    { id: 'day', label: 'Day' },
    { id: 'wk', label: 'Wk' },
    { id: 'mo', label: 'Mo' },
];

const LABEL_POSITION_OPTIONS = [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Center' },
    { id: 'right', label: 'Right' },
];

const COMPLEX_TOOLS = new Set([
    'fib', 'fibext', 'pitchfork', 'elliott', 'gannfan', 'fibtimezone',
]);

const DEFAULT_FIB_LEVELS = [
    { value: 0, color: '#787B86', visible: true },
    { value: 0.236, color: '#F44336', visible: true },
    { value: 0.382, color: '#FF9800', visible: true },
    { value: 0.5, color: '#2196F3', visible: true },
    { value: 0.618, color: '#4CAF50', visible: true },
    { value: 0.786, color: '#9C27B0', visible: true },
    { value: 1.0, color: '#787B86', visible: true },
    { value: 1.618, color: '#E91E63', visible: false },
    { value: 2.618, color: '#00BCD4', visible: false },
    { value: 4.236, color: '#FF5722', visible: false },
];

const TOOL_LABELS = {
    trendline: 'Trend Line', hline: 'Horizontal Line', vline: 'Vertical Line',
    ray: 'Ray', arrow: 'Arrow', fib: 'Fib Retracement', fibext: 'Fib Extension',
    rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle',
    alertzone: 'Alert Zone', text: 'Text', callout: 'Callout',
    measure: 'Measure', channel: 'Channel', crossline: 'Crossline',
    hray: 'Horizontal Ray', extendedline: 'Extended Line',
    pitchfork: 'Pitchfork', elliott: 'Elliott Wave',
    gannfan: 'Gann Fan', fibtimezone: 'Fib Time Zone',
    longposition: 'Long Position', shortposition: 'Short Position',
};

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseTimeInput(str) {
    const d = new Date(str.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d.getTime();
}

// ─── Main Component ─────────────────────────────────────────────

export default function DrawingSettingsDialog({ drawing, engine, onClose }) {
    const [activeTab, setActiveTab] = useState('style');
    const drawingDefaults = useChartToolsStore((s) => s.drawingDefaults) || {};
    const setDrawingDefault = useChartToolsStore((s) => s.setDrawingDefault);

    // ─── Local state ──────────────────────────────────────────────
    const [color, setColor] = useState(drawing?.style?.color || '#2962FF');
    const [lineWidth, setLineWidth] = useState(drawing?.style?.lineWidth || 2);
    const [dash, setDash] = useState(drawing?.style?.dash || []);
    const [fillColor, setFillColor] = useState(drawing?.style?.fillColor || 'rgba(41, 98, 255, 0.1)');
    const [showFill, setShowFill] = useState(drawing?.style?.showFill !== false);
    const [points, setPoints] = useState(drawing?.points?.map((p) => ({ ...p })) || []);
    const [showPrices, setShowPrices] = useState(drawing?.style?.showPrices !== false);
    const [showPercentages, setShowPercentages] = useState(drawing?.style?.showPercentages !== false);
    const [labelPosition, setLabelPosition] = useState(drawing?.style?.labelPosition || 'right');
    const [useLogScale, setUseLogScale] = useState(drawing?.style?.logScale || false);
    const [fibLevels, setFibLevels] = useState(
        drawing?.style?.fibLevels || drawingDefaults[drawing?.type]?.fibLevels || DEFAULT_FIB_LEVELS
    );
    const [visibility, setVisibility] = useState(
        drawing?.visibility || { timeframes: [], showAll: true }
    );

    if (!drawing) return null;

    const isFib = drawing.type === 'fib' || drawing.type === 'fibext' || drawing.type === 'fibtimezone';
    const toolLabel = TOOL_LABELS[drawing.type] || drawing.type;

    // ─── Apply style to engine ────────────────────────────────────
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const updateStyle = useCallback((key, value) => {
        if (!engine || !drawing.id) return;
        engine.updateStyle(drawing.id, { [key]: value });
    }, [engine, drawing.id]);

    const handleColorChange = (c) => {
        setColor(c);
        updateStyle('color', c);
    };

    const handleLineWidthChange = (w) => {
        setLineWidth(w);
        updateStyle('lineWidth', w);
    };

    const handleDashChange = (d) => {
        setDash(d);
        updateStyle('dash', d);
    };

    const handlePointChange = (idx, field, value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        const newPoints = [...points];
        newPoints[idx] = { ...newPoints[idx], [field]: numValue };
        setPoints(newPoints);

        if (engine) {
            const d = engine.drawings.find((d) => d.id === drawing.id);
            if (d && d.points[idx]) {
                d.points[idx] = { ...newPoints[idx] };
                window.dispatchEvent(new CustomEvent('charEdge:update-drawing-style', {
                    detail: { id: drawing.id, style: {} },
                }));
            }
        }
    };

    // ─── Save as default for this tool ────────────────────────────
    const handleSaveAsDefault = () => {
        if (setDrawingDefault) {
            const defaults = { color, lineWidth, dash, showFill, fillColor, showPrices, showPercentages, labelPosition, logScale: useLogScale };
            if (isFib) defaults.fibLevels = fibLevels;
            setDrawingDefault(drawing.type, defaults);
        }
    };

    return (
        <SettingsTabShell
            title={toolLabel}
            iconColor={color}
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={onClose}
            onOk={onClose}
            onCancel={onClose}
        >
            {/* ═══ Style Tab ═══════════════════════════════════════════ */}
            {activeTab === 'style' && (
                <div>
                    <SectionLabel>Line</SectionLabel>
                    <ColorSwatch label="Color" color={color} onChange={handleColorChange} />
                    <RangeSlider
                        label="Width"
                        value={lineWidth}
                        min={1}
                        max={5}
                        step={1}
                        onChange={handleLineWidthChange}
                    />
                    <LineStylePicker label="Style" value={dash} onChange={handleDashChange} />

                    {/* Fill controls */}
                    <SectionLabel>Fill</SectionLabel>
                    <Toggle label="Show Fill" checked={showFill} onChange={(v) => { setShowFill(v); updateStyle('showFill', v); }} />
                    {showFill && (
                        <ColorSwatch label="Fill Color" color={fillColor} onChange={(c) => { setFillColor(c); updateStyle('fillColor', c); }} />
                    )}

                    {/* Fib-specific controls */}
                    {isFib && (
                        <>
                            <SectionLabel>Fib Levels</SectionLabel>
                            {fibLevels.map((level, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '4px 0',
                                        opacity: level.visible ? 1 : 0.4,
                                    }}
                                >
                                    <button
                                        onClick={() => {
                                            const next = [...fibLevels];
                                            next[i] = { ...next[i], visible: !next[i].visible };
                                            setFibLevels(next);
                                            updateStyle('fibLevels', next);
                                        }}
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 4,
                                            border: `1px solid ${C.bd}`,
                                            background: level.visible ? C.b + '20' : 'transparent',
                                            color: level.visible ? C.b : C.t3,
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {level.visible ? '✓' : ''}
                                    </button>
                                    <span style={{ fontFamily: M, fontSize: 12, color: C.t1, width: 48 }}>
                                        {level.value}
                                    </span>
                                    <ColorSwatch
                                        color={level.color}
                                        onChange={(c) => {
                                            const next = [...fibLevels];
                                            next[i] = { ...next[i], color: c };
                                            setFibLevels(next);
                                            updateStyle('fibLevels', next);
                                        }}
                                    />
                                </div>
                            ))}

                            <SectionLabel>Labels</SectionLabel>
                            <Toggle
                                label="Show Prices"
                                checked={showPrices}
                                onChange={(v) => { setShowPrices(v); updateStyle('showPrices', v); }}
                            />
                            <Toggle
                                label="Show Percentages"
                                checked={showPercentages}
                                onChange={(v) => { setShowPercentages(v); updateStyle('showPercentages', v); }}
                            />
                            <SelectDropdown
                                label="Label Position"
                                value={labelPosition}
                                options={LABEL_POSITION_OPTIONS}
                                onChange={(v) => { setLabelPosition(v); updateStyle('labelPosition', v); }}
                            />
                            <Toggle
                                label="Log Scale"
                                checked={useLogScale}
                                onChange={(v) => { setUseLogScale(v); updateStyle('logScale', v); }}
                            />
                        </>
                    )}

                    {/* Save as default */}
                    <div style={{ marginTop: 16 }}>
                        <button
                            onClick={handleSaveAsDefault}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: `1px solid ${C.b}40`,
                                background: C.b + '15',
                                color: C.b,
                                fontFamily: F,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            Save as Default for {toolLabel}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ Coordinates Tab ═════════════════════════════════════ */}
            {activeTab === 'coordinates' && (
                <div>
                    <SectionLabel>Anchor Points</SectionLabel>
                    {points.map((pt, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '8px 10px',
                                marginBottom: 8,
                                borderRadius: 8,
                                background: C.sf,
                                border: `1px solid ${C.bd}`,
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>
                                Point {i + 1}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginBottom: 3 }}>Price</div>
                                    <input
                                        type="number"
                                        value={pt.price >= 1000 ? pt.price.toFixed(0) : pt.price.toFixed(2)}
                                        onChange={(e) => handlePointChange(i, 'price', e.target.value)}
                                        step={pt.price >= 100 ? 1 : 0.01}
                                        style={{
                                            width: '100%',
                                            padding: '5px 8px',
                                            borderRadius: 6,
                                            border: `1px solid ${C.bd}`,
                                            background: 'rgba(22, 24, 29, 0.8)',
                                            color: C.t1,
                                            fontFamily: M,
                                            fontSize: 12,
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginBottom: 3 }}>Date/Time</div>
                                    <input
                                        type="text"
                                        defaultValue={formatTime(pt.time)}
                                        onBlur={(e) => {
                                            const t = parseTimeInput(e.target.value);
                                            if (t) handlePointChange(i, 'time', t);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '5px 8px',
                                            borderRadius: 6,
                                            border: `1px solid ${C.bd}`,
                                            background: 'rgba(22, 24, 29, 0.8)',
                                            color: C.t1,
                                            fontFamily: M,
                                            fontSize: 11,
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {points.length === 0 && (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.t3, fontFamily: F }}>
                            No anchor points for this drawing type.
                        </div>
                    )}
                </div>
            )}

            {/* ═══ Visibility Tab ══════════════════════════════════════ */}
            {activeTab === 'visibility' && (
                <div>
                    <SectionLabel>Timeframe Visibility</SectionLabel>

                    <Toggle
                        label="Show on all timeframes"
                        checked={visibility.showAll !== false}
                        onChange={(v) => {
                            const next = { showAll: v, timeframes: v ? [] : visibility.timeframes };
                            setVisibility(next);
                            // Update engine drawing
                            if (engine) {
                                const d = engine.drawings.find((d) => d.id === drawing.id);
                                if (d) d.visibility = next;
                            }
                        }}
                    />

                    {!visibility.showAll && (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 6,
                                marginTop: 10,
                            }}
                        >
                            {TIMEFRAMES.map((tf) => {
                                const isActive = visibility.timeframes?.includes(tf.id);
                                return (
                                    <button
                                        key={tf.id}
                                        onClick={() => {
                                            const tfs = visibility.timeframes || [];
                                            const next = isActive
                                                ? tfs.filter((t) => t !== tf.id)
                                                : [...tfs, tf.id];
                                            const vis = { showAll: false, timeframes: next };
                                            setVisibility(vis);
                                            if (engine) {
                                                const d = engine.drawings.find((d) => d.id === drawing.id);
                                                if (d) d.visibility = vis;
                                            }
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: `1px solid ${isActive ? C.b + '60' : C.bd}`,
                                            background: isActive ? C.b + '15' : 'transparent',
                                            color: isActive ? C.b : C.t2,
                                            fontFamily: F,
                                            fontSize: 12,
                                            fontWeight: isActive ? 600 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.12s ease',
                                        }}
                                    >
                                        {tf.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Cross-TF sync info */}
                    <div
                        style={{
                            marginTop: 16,
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: C.sf,
                            border: `1px solid ${C.bd}`,
                            fontSize: 11,
                            color: C.t3,
                            fontFamily: F,
                            lineHeight: 1.5,
                        }}
                    >
                        🔗 Cross-timeframe sync can also be toggled from the compact edit popup using the link icon.
                    </div>
                </div>
            )}
        </SettingsTabShell>
    );
}

/** Check if a drawing type is "complex" (should show gear icon) */
DrawingSettingsDialog.isComplexTool = (type) => COMPLEX_TOOLS.has(type);
