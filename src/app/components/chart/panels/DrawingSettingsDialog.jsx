// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Settings Dialog (TradingView-Grade Overhaul)
//
// Full settings dialog matching TradingView's 4-tab layout:
//   Style | Text | Coordinates | Visibility
// (Long/Short Position gets: Inputs | Style | Visibility)
//
// Now available for ALL 42 tools (no more COMPLEX_TOOLS gate).
// Tool-config-driven: each tool type declares supported features.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { C, F, M } from '@/constants.js';
import {
    ColorSwatch,
    Toggle,
    RangeSlider,
    SelectDropdown,
    LineStylePicker,
    SectionLabel,
    CheckboxRow,
    LineCompound,
    LineEndPicker,
    FontToolbar,
    StyledTextArea,
    TextAlignmentPicker,
    StepperInput,
    TimeframeVisibilityRow,
} from '../../settings/SettingsControls.jsx';
import SettingsTabShell from '../../settings/SettingsTabShell.jsx';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { saveTemplate, loadTemplates, deleteTemplate } from '../../../../charting_library/tools/engines/DrawingTemplates.js';

// ─── Tool Config ────────────────────────────────────────────────
// Declares which features each tool supports.

const LINE_TOOLS = new Set([
    'trendline', 'ray', 'hray', 'extendedline', 'arrow',
    'crossline', 'infoline', 'polyline',
]);

const SHAPE_TOOLS = new Set([
    'rect', 'ellipse', 'triangle', 'alertzone', 'parallelchannel',
]);

const FIB_TOOLS = new Set([
    'fib', 'fibext', 'fibtimezone', 'fibarc', 'fibfan', 'fibchannel',
]);

const CHANNEL_TOOLS = new Set([
    'channel', 'parallelchannel', 'regressionchannel', 'pitchfork',
]);

const TRADE_TOOLS = new Set(['longposition', 'shortposition']);

const ANNOTATION_TOOLS = new Set([
    'text', 'callout', 'note', 'signpost', 'emoji',
]);

const MEASUREMENT_TOOLS = new Set([
    'measure', 'pricerange', 'daterange',
]);

function getToolConfig(type) {
    // Position tools have their own special layout
    if (TRADE_TOOLS.has(type)) {
        return {
            tabs: ['inputs', 'style', 'visibility'],
            hasInputs: true,
            hasExtend: false,
            hasLineEnds: false,
            hasMiddlePoint: false,
            hasPriceLabels: true,
            hasStats: true,
            hasCompactStats: true,
            hasBackground: false,
            hasMiddleLine: false,
            hasBorder: false,
            hasStopTargetColors: true,
            hasFibLevels: false,
            hasText: false,
            hasLineCompound: true,
        };
    }
    // Fib tools
    if (FIB_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: true,
            hasLineEnds: false,
            hasMiddlePoint: false,
            hasPriceLabels: true,
            hasStats: false,
            hasBackground: true,
            hasMiddleLine: false,
            hasBorder: false,
            hasFibLevels: true,
            hasText: true,
            hasLineCompound: true,
        };
    }
    // Shape tools
    if (SHAPE_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: type === 'rect' || type === 'parallelchannel',
            hasLineEnds: false,
            hasMiddlePoint: false,
            hasPriceLabels: false,
            hasStats: false,
            hasBackground: true,
            hasMiddleLine: type === 'rect',
            hasBorder: true,
            hasFibLevels: false,
            hasText: true,
            hasLineCompound: true,
        };
    }
    // Line tools
    if (LINE_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: type !== 'extendedline',
            hasLineEnds: type === 'trendline' || type === 'ray' || type === 'extendedline',
            hasMiddlePoint: type === 'trendline' || type === 'ray',
            hasPriceLabels: true,
            hasStats: true,
            hasBackground: false,
            hasMiddleLine: false,
            hasBorder: false,
            hasFibLevels: false,
            hasText: true,
            hasLineCompound: true,
        };
    }
    // Channel tools
    if (CHANNEL_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: true,
            hasLineEnds: false,
            hasMiddlePoint: true,
            hasPriceLabels: false,
            hasStats: false,
            hasBackground: true,
            hasMiddleLine: true,
            hasBorder: true,
            hasFibLevels: false,
            hasText: true,
            hasLineCompound: true,
        };
    }
    // Annotation tools
    if (ANNOTATION_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: false,
            hasLineEnds: false,
            hasMiddlePoint: false,
            hasPriceLabels: false,
            hasStats: false,
            hasBackground: type === 'callout' || type === 'note',
            hasMiddleLine: false,
            hasBorder: type === 'callout',
            hasFibLevels: false,
            hasText: true,
            hasLineCompound: type === 'callout',
        };
    }
    // Measurement tools
    if (MEASUREMENT_TOOLS.has(type)) {
        return {
            tabs: ['style', 'text', 'coordinates', 'visibility'],
            hasExtend: type === 'pricerange',
            hasLineEnds: false,
            hasMiddlePoint: false,
            hasPriceLabels: true,
            hasStats: true,
            hasBackground: true,
            hasMiddleLine: false,
            hasBorder: false,
            hasFibLevels: false,
            hasText: true,
            hasLineCompound: true,
        };
    }
    // Default fallback for remaining tools (gannfan, gannsquare, xabcd, etc.)
    return {
        tabs: ['style', 'text', 'coordinates', 'visibility'],
        hasExtend: false,
        hasLineEnds: false,
        hasMiddlePoint: false,
        hasPriceLabels: false,
        hasStats: false,
        hasBackground: false,
        hasMiddleLine: false,
        hasBorder: false,
        hasFibLevels: false,
        hasText: true,
        hasLineCompound: true,
    };
}

// ─── Constants ──────────────────────────────────────────────────

const EXTEND_OPTIONS = [
    { id: 'none', label: "Don't extend" },
    { id: 'left', label: 'Extend left' },
    { id: 'right', label: 'Extend right' },
    { id: 'both', label: 'Extend both' },
];

const STATS_OPTIONS = [
    { id: 'hidden', label: 'Hidden' },
    { id: 'values', label: 'Values' },
    { id: 'percent', label: 'Percent' },
    { id: 'both', label: 'Values & Percent' },
];

const STATS_POSITION_OPTIONS = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
];

const LABEL_POSITION_OPTIONS = [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Center' },
    { id: 'right', label: 'Right' },
];

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

import { TOOL_LABELS } from '../../../../shared/drawingToolRegistry';


const TIMEFRAME_ROWS = [
    { id: 'seconds', label: 'Seconds', min: 1, max: 59 },
    { id: 'minutes', label: 'Minutes', min: 1, max: 59 },
    { id: 'hours', label: 'Hours', min: 1, max: 24 },
    { id: 'days', label: 'Days', min: 1, max: 366 },
    { id: 'weeks', label: 'Weeks', min: 1, max: 52 },
    { id: 'months', label: 'Months', min: 1, max: 12 },
];

const RISK_UNIT_OPTIONS = [
    { id: '%', label: '%' },
    { id: '$', label: '$' },
];

const QTY_PRECISION_OPTIONS = [
    { id: 'default', label: 'Default' },
    { id: '0', label: '0' },
    { id: '1', label: '0.0' },
    { id: '2', label: '0.00' },
    { id: '3', label: '0.000' },
];

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
    const config = drawing ? getToolConfig(drawing.type) : getToolConfig('trendline');
    const tabDefs = (config.tabs || []).map((id) => ({
        id,
        label: id === 'inputs' ? 'Inputs' : id.charAt(0).toUpperCase() + id.slice(1),
    }));

    const [activeTab, setActiveTab] = useState(tabDefs[0]?.id || 'style');
    const drawingDefaults = useChartToolsStore((s) => s.drawingDefaults) || {};
    const setDrawingDefault = useChartToolsStore((s) => s.setDrawingDefault);

    // ─── Style Local State ───────────────────────────────────────
    const s = drawing?.style || {};
    const [color, setColor] = useState(s.color || '#2962FF');
    const [lineWidth, setLineWidth] = useState(s.lineWidth || 2);
    const [dash, setDash] = useState(s.dash || []);
    const [fillColor, setFillColor] = useState(s.fillColor || 'rgba(41, 98, 255, 0.1)');
    const [showFill, setShowFill] = useState(s.showFill !== false);
    const [extend, setExtend] = useState(s.extend || 'none');
    const [lineEndLeft, setLineEndLeft] = useState(s.lineEndLeft || 'none');
    const [lineEndRight, setLineEndRight] = useState(s.lineEndRight || 'none');
    const [middlePoint, setMiddlePoint] = useState(s.middlePoint || false);
    const [priceLabels, setPriceLabels] = useState(s.priceLabels !== false);
    const [stats, setStats] = useState(s.stats || 'hidden');
    const [statsPosition, setStatsPosition] = useState(s.statsPosition || 'right');
    const [alwaysShowStats, setAlwaysShowStats] = useState(s.alwaysShowStats || false);
    const [compactStats, setCompactStats] = useState(s.compactStats || false);
    const [middleLine, setMiddleLine] = useState(s.middleLine || false);
    const [middleLineColor, setMiddleLineColor] = useState(s.middleLineColor || '#787B86');
    const [middleLineDash, setMiddleLineDash] = useState(s.middleLineDash || [4, 4]);
    const [borderColor, setBorderColor] = useState(s.borderColor || s.color || '#2962FF');
    const [showBackground, setShowBackground] = useState(s.showBackground !== false);
    const [stopColor, setStopColor] = useState(s.stopColor || '#F23645');
    const [targetColor, setTargetColor] = useState(s.targetColor || '#089981');
    const [showPrices, setShowPrices] = useState(s.showPrices !== false);
    const [showPercentages, setShowPercentages] = useState(s.showPercentages !== false);
    const [labelPosition, setLabelPosition] = useState(s.labelPosition || 'right');
    const [useLogScale, setUseLogScale] = useState(s.logScale || false);

    // ─── Text Local State ────────────────────────────────────────
    const [textContent, setTextContent] = useState(s.text || drawing?.meta?.text || '');
    const [textColor, setTextColor] = useState(s.textColor || '#D1D4DC');
    const [fontSize, setFontSize] = useState(s.fontSize || 14);
    const [fontBold, setFontBold] = useState(s.fontBold || false);
    const [fontItalic, setFontItalic] = useState(s.fontItalic || false);
    const [textAlignV, setTextAlignV] = useState(s.textAlignV || 'bottom');
    const [textAlignH, setTextAlignH] = useState(s.textAlignH || 'left');

    // ─── Coordinates Local State ─────────────────────────────────
    const [points, setPoints] = useState(drawing?.points?.map((p) => ({ ...p })) || []);

    // ─── Fib Local State ─────────────────────────────────────────
    const [fibLevels, setFibLevels] = useState(
        s.fibLevels || drawingDefaults[drawing?.type]?.fibLevels || DEFAULT_FIB_LEVELS
    );

    // ─── Visibility Local State ──────────────────────────────────
    const [visibilityTicks, setVisibilityTicks] = useState(
        drawing?.visibility?.ticks !== false
    );
    const [visibilityRanges, setVisibilityRanges] = useState(
        drawing?.visibility?.ranges !== false
    );
    const [tfState, setTfState] = useState(() => {
        const saved = drawing?.visibility?.timeframes || {};
        const initial = {};
        for (const row of TIMEFRAME_ROWS) {
            initial[row.id] = {
                enabled: saved[row.id]?.enabled !== false,
                min: saved[row.id]?.min ?? row.min,
                max: saved[row.id]?.max ?? row.max,
            };
        }
        return initial;
    });

    // ─── Inputs Local State (Position tools) ─────────────────────
    const [accountSize, setAccountSize] = useState(s.accountSize || 1000);
    const [lotSize, setLotSize] = useState(s.lotSize || 0.04);
    const [risk, setRisk] = useState(s.risk || 1);
    const [riskUnit, setRiskUnit] = useState(s.riskUnit || '%');
    const [entryPrice, setEntryPrice] = useState(s.entryPrice || drawing?.points?.[0]?.price || 0);
    const [leverage, setLeverage] = useState(s.leverage || 10000);
    const [profitTicks, setProfitTicks] = useState(s.profitTicks || 0);
    const [profitPrice, setProfitPrice] = useState(s.profitPrice || drawing?.points?.[1]?.price || 0);
    const [stopTicks, setStopTicks] = useState(s.stopTicks || 0);
    const [stopPrice, setStopPrice] = useState(s.stopPrice || 0);
    const [qtyPrecision, setQtyPrecision] = useState(s.qtyPrecision || 'default');

    // ─── Template State ──────────────────────────────────────────
    const [templates, setTemplates] = useState(() => loadTemplates(drawing?.type));
    const [templateName, setTemplateName] = useState('');
    const [showTemplateSave, setShowTemplateSave] = useState(false);

    if (!drawing) return null;

    const toolLabel = TOOL_LABELS[drawing.type] || drawing.type;

    // ─── Apply style to engine ────────────────────────────────────
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const updateStyle = useCallback((key, value) => {
        if (!engine || !drawing.id) return;
        engine.updateStyle(drawing.id, { [key]: value });
    }, [engine, drawing.id]);

    const applyAndSet = (setter, key) => (val) => {
        setter(val);
        updateStyle(key, val);
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

    const handleSaveAsDefault = () => {
        if (setDrawingDefault) {
            const defaults = {
                color, lineWidth, dash, showFill, fillColor, showPrices, showPercentages,
                labelPosition, logScale: useLogScale, extend, lineEndLeft, lineEndRight,
                middlePoint, priceLabels, stats, statsPosition, alwaysShowStats,
                middleLine, middleLineColor, middleLineDash, borderColor,
                showBackground, textColor, fontSize, fontBold, fontItalic,
                textAlignV, textAlignH,
            };
            if (config.hasFibLevels) defaults.fibLevels = fibLevels;
            if (config.hasStopTargetColors) {
                Object.assign(defaults, { stopColor, targetColor, compactStats });
            }
            setDrawingDefault(drawing.type, defaults);
        }
    };

    const updateVisibility = () => {
        if (engine) {
            const d = engine.drawings.find((d) => d.id === drawing.id);
            if (d) {
                d.visibility = {
                    ticks: visibilityTicks,
                    ranges: visibilityRanges,
                    timeframes: tfState,
                };
            }
        }
    };

    // ─── Template Footer ─────────────────────────────────────────
    const currentStyle = {
        color, lineWidth, dash, fillColor, showFill, extend, lineEndLeft, lineEndRight,
        middlePoint, priceLabels, stats, statsPosition, alwaysShowStats, middleLine,
        middleLineColor, middleLineDash, borderColor, showBackground, textColor,
        fontSize, fontBold: fontBold, fontItalic: fontItalic, textAlignV, textAlignH,
    };

    const handleSaveTemplate = () => {
        if (!templateName.trim()) return;
        saveTemplate(drawing.type, templateName.trim(), currentStyle);
        setTemplates(loadTemplates(drawing.type));
        setTemplateName('');
        setShowTemplateSave(false);
    };

    const handleLoadTemplate = (tmpl) => {
        const ts = tmpl.style;
        if (ts.color) { setColor(ts.color); updateStyle('color', ts.color); }
        if (ts.lineWidth) { setLineWidth(ts.lineWidth); updateStyle('lineWidth', ts.lineWidth); }
        if (ts.dash) { setDash(ts.dash); updateStyle('dash', ts.dash); }
        if (ts.fillColor) { setFillColor(ts.fillColor); updateStyle('fillColor', ts.fillColor); }
        if (ts.extend) { setExtend(ts.extend); updateStyle('extend', ts.extend); }
        if (ts.textColor) { setTextColor(ts.textColor); updateStyle('textColor', ts.textColor); }
        if (ts.fontSize) { setFontSize(ts.fontSize); updateStyle('fontSize', ts.fontSize); }
    };

    const handleDeleteTemplate = (name) => {
        deleteTemplate(drawing.type, name);
        setTemplates(loadTemplates(drawing.type));
    };

    const templateFooter = (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {templates.length > 0 && (
                <select
                    onChange={(e) => {
                        const tmpl = templates.find(t => t.name === e.target.value);
                        if (tmpl) handleLoadTemplate(tmpl);
                        e.target.value = '';
                    }}
                    defaultValue=""
                    style={{
                        padding: '4px 8px', borderRadius: 6,
                        border: `1px solid ${C.bd}`, background: C.sf,
                        color: C.t1, fontFamily: F, fontSize: 11,
                        cursor: 'pointer', outline: 'none',
                    }}
                >
                    <option value="" disabled>Templates</option>
                    {templates.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                </select>
            )}
            {showTemplateSave ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                        placeholder="Name"
                        autoFocus
                        style={{
                            width: 80, padding: '3px 6px', borderRadius: 5,
                            border: `1px solid ${C.bd}`, background: C.sf,
                            color: C.t1, fontSize: 11, fontFamily: F, outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleSaveTemplate}
                        style={{
                            padding: '3px 8px', borderRadius: 5, border: 'none',
                            background: C.b, color: '#fff', fontSize: 11,
                            fontFamily: F, cursor: 'pointer',
                        }}
                    >Save</button>
                    <button
                        onClick={() => setShowTemplateSave(false)}
                        style={{
                            padding: '3px 6px', borderRadius: 5,
                            border: `1px solid ${C.bd}`, background: 'transparent',
                            color: C.t2, fontSize: 11, cursor: 'pointer',
                        }}
                    >✕</button>
                </div>
            ) : (
                <button
                    onClick={() => setShowTemplateSave(true)}
                    style={{
                        padding: '3px 8px', borderRadius: 5,
                        border: `1px solid ${C.bd}`, background: 'transparent',
                        color: C.t2, fontSize: 11, fontFamily: F,
                        cursor: 'pointer',
                    }}
                >+ Save Template</button>
            )}
            {templates.length > 0 && (
                <button
                    onClick={() => {
                        const name = templates[templates.length - 1]?.name;
                        if (name && confirm(`Delete template "${name}"?`)) handleDeleteTemplate(name);
                    }}
                    style={{
                        padding: '3px 6px', borderRadius: 5,
                        border: `1px solid ${C.bd}`, background: 'transparent',
                        color: '#EF5350', fontSize: 11, cursor: 'pointer',
                    }}
                    title="Delete last template"
                >🗑</button>
            )}
        </div>
    );

    return (
        <SettingsTabShell
            title={toolLabel}
            iconColor={color}
            tabs={tabDefs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={onClose}
            onOk={onClose}
            onCancel={onClose}
            footerExtra={templateFooter}
        >
            {/* ═══ INPUTS TAB (Position Tools) ═══════════════════════ */}
            {activeTab === 'inputs' && config.hasInputs && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <StepperInput
                            label="Account size"
                            value={accountSize}
                            onChange={applyAndSet(setAccountSize, 'accountSize')}
                            step={100}
                            min={0}
                        />
                        <SelectDropdown
                            value="default"
                            options={[{ id: 'default', label: 'Default' }]}
                            onChange={() => {}}
                        />
                    </div>
                    <StepperInput label="Lot size" value={lotSize} onChange={applyAndSet(setLotSize, 'lotSize')} step={0.01} min={0.01} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                        <StepperInput label="Risk" value={risk} onChange={applyAndSet(setRisk, 'risk')} step={0.5} min={0} />
                        <SelectDropdown value={riskUnit} options={RISK_UNIT_OPTIONS} onChange={applyAndSet(setRiskUnit, 'riskUnit')} />
                    </div>
                    <StepperInput label="Entry price" value={entryPrice} onChange={applyAndSet(setEntryPrice, 'entryPrice')} step={0.1} />
                    <StepperInput label="Leverage" value={leverage} onChange={applyAndSet(setLeverage, 'leverage')} step={1} min={1} />

                    <SectionLabel>Profit Level</SectionLabel>
                    <StepperInput label="Ticks" value={profitTicks} onChange={applyAndSet(setProfitTicks, 'profitTicks')} step={1} min={0} />
                    <StepperInput label="Price" value={profitPrice} onChange={applyAndSet(setProfitPrice, 'profitPrice')} step={0.1} />

                    <SectionLabel>Stop Level</SectionLabel>
                    <StepperInput label="Ticks" value={stopTicks} onChange={applyAndSet(setStopTicks, 'stopTicks')} step={1} min={0} />
                    <StepperInput label="Price" value={stopPrice} onChange={applyAndSet(setStopPrice, 'stopPrice')} step={0.1} />

                    <div style={{ padding: '8px 0' }}>
                        <SelectDropdown label="QTY precision" value={qtyPrecision} options={QTY_PRECISION_OPTIONS} onChange={applyAndSet(setQtyPrecision, 'qtyPrecision')} />
                    </div>
                </div>
            )}

            {/* ═══ STYLE TAB ═════════════════════════════════════════ */}
            {activeTab === 'style' && (
                <div>
                    {/* Line compound control */}
                    {config.hasLineCompound && (
                        <LineCompound
                            label={config.hasBorder ? 'Border' : (config.hasStopTargetColors ? 'Lines' : 'Line')}
                            color={config.hasBorder ? borderColor : color}
                            onColorChange={config.hasBorder
                                ? applyAndSet(setBorderColor, 'borderColor')
                                : applyAndSet(setColor, 'color')
                            }
                            lineWidth={lineWidth}
                            onWidthChange={applyAndSet(setLineWidth, 'lineWidth')}
                            dash={dash}
                            onDashChange={applyAndSet(setDash, 'dash')}
                        />
                    )}

                    {/* Stop / Target colors (Position tools) */}
                    {config.hasStopTargetColors && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                <span style={{ fontSize: 13, fontFamily: F, color: C.t1, minWidth: 80 }}>Stop color</span>
                                <ColorSwatch color={stopColor} onChange={applyAndSet(setStopColor, 'stopColor')} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                <span style={{ fontSize: 13, fontFamily: F, color: C.t1, minWidth: 80 }}>Target color</span>
                                <ColorSwatch color={targetColor} onChange={applyAndSet(setTargetColor, 'targetColor')} />
                            </div>
                            {/* Text color + size on Style tab for position tools */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                                <span style={{ fontSize: 13, fontFamily: F, color: C.t1, minWidth: 80 }}>Text</span>
                                <ColorSwatch color={textColor} onChange={applyAndSet(setTextColor, 'textColor')} />
                                <SelectDropdown
                                    value={fontSize}
                                    options={[10, 11, 12, 14, 16, 18, 20, 24].map((s) => ({ id: s, label: String(s) }))}
                                    onChange={(v) => { setFontSize(parseInt(v)); updateStyle('fontSize', parseInt(v)); }}
                                />
                            </div>
                        </>
                    )}

                    {/* Line end styles */}
                    {config.hasLineEnds && (
                        <LineEndPicker
                            label="Line ends"
                            leftEnd={lineEndLeft}
                            rightEnd={lineEndRight}
                            onLeftChange={applyAndSet(setLineEndLeft, 'lineEndLeft')}
                            onRightChange={applyAndSet(setLineEndRight, 'lineEndRight')}
                        />
                    )}

                    {/* Middle line (shapes) */}
                    {config.hasMiddleLine && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                            <CheckboxRow
                                label="Middle line"
                                checked={middleLine}
                                onChange={applyAndSet(setMiddleLine, 'middleLine')}
                            />
                            {middleLine && (
                                <>
                                    <ColorSwatch color={middleLineColor} onChange={applyAndSet(setMiddleLineColor, 'middleLineColor')} />
                                    <LineStylePicker value={middleLineDash} onChange={applyAndSet(setMiddleLineDash, 'middleLineDash')} />
                                </>
                            )}
                        </div>
                    )}

                    {/* Background (shapes) */}
                    {config.hasBackground && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                            <CheckboxRow
                                label="Background"
                                checked={showBackground}
                                onChange={applyAndSet(setShowBackground, 'showBackground')}
                            />
                            {showBackground && (
                                <ColorSwatch color={fillColor} onChange={applyAndSet(setFillColor, 'fillColor')} />
                            )}
                        </div>
                    )}

                    {/* Extend dropdown */}
                    {config.hasExtend && (
                        <div style={{ padding: '6px 0' }}>
                            <SelectDropdown
                                label="Extend"
                                value={extend}
                                options={EXTEND_OPTIONS}
                                onChange={applyAndSet(setExtend, 'extend')}
                            />
                        </div>
                    )}

                    {/* Middle point (lines) */}
                    {config.hasMiddlePoint && (
                        <CheckboxRow
                            label="Middle point"
                            checked={middlePoint}
                            onChange={applyAndSet(setMiddlePoint, 'middlePoint')}
                        />
                    )}

                    {/* Price labels */}
                    {config.hasPriceLabels && (
                        <CheckboxRow
                            label="Price labels"
                            checked={priceLabels}
                            onChange={applyAndSet(setPriceLabels, 'priceLabels')}
                        />
                    )}

                    {/* INFO section */}
                    {config.hasStats && (
                        <>
                            <SectionLabel>Info</SectionLabel>
                            <SelectDropdown
                                label="Stats"
                                value={stats}
                                options={STATS_OPTIONS}
                                onChange={applyAndSet(setStats, 'stats')}
                            />
                            {stats !== 'hidden' && (
                                <>
                                    <SelectDropdown
                                        label="Stats position"
                                        value={statsPosition}
                                        options={STATS_POSITION_OPTIONS}
                                        onChange={applyAndSet(setStatsPosition, 'statsPosition')}
                                    />
                                    {config.hasCompactStats && (
                                        <CheckboxRow
                                            label="Compact stats mode"
                                            checked={compactStats}
                                            onChange={applyAndSet(setCompactStats, 'compactStats')}
                                        />
                                    )}
                                    <CheckboxRow
                                        label="Always show stats"
                                        checked={alwaysShowStats}
                                        onChange={applyAndSet(setAlwaysShowStats, 'alwaysShowStats')}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {/* Fib levels */}
                    {config.hasFibLevels && (
                        <>
                            <SectionLabel>Fib Levels</SectionLabel>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '2px 16px',
                            }}>
                                {fibLevels.map((level, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '3px 0',
                                            opacity: level.visible ? 1 : 0.35,
                                            transition: 'opacity 0.12s ease',
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
                                                width: 18,
                                                height: 18,
                                                borderRadius: 4,
                                                border: `1.5px solid ${level.visible ? C.b : C.bd}`,
                                                background: level.visible ? C.b : 'transparent',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                padding: 0,
                                                transition: 'all 0.12s ease',
                                            }}
                                        >
                                            {level.visible && (
                                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </button>
                                        <input
                                            type="number"
                                            value={level.value}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                if (isNaN(v)) return;
                                                const next = [...fibLevels];
                                                next[i] = { ...next[i], value: v };
                                                setFibLevels(next);
                                                updateStyle('fibLevels', next);
                                            }}
                                            step={0.001}
                                            style={{
                                                width: 52,
                                                padding: '3px 5px',
                                                borderRadius: 4,
                                                border: `1px solid ${C.bd}`,
                                                background: C.sf,
                                                color: C.t1,
                                                fontFamily: M,
                                                fontSize: 11,
                                                outline: 'none',
                                                textAlign: 'right',
                                            }}
                                        />
                                        <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                                            <div style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 5,
                                                background: level.color,
                                                border: `1px solid ${C.bd}`,
                                            }} />
                                            <input
                                                type="color"
                                                value={level.color}
                                                onChange={(e) => {
                                                    const next = [...fibLevels];
                                                    next[i] = { ...next[i], color: e.target.value };
                                                    setFibLevels(next);
                                                    updateStyle('fibLevels', next);
                                                }}
                                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <SectionLabel>Labels</SectionLabel>
                            <CheckboxRow label="Show Prices" checked={showPrices} onChange={(v) => { setShowPrices(v); updateStyle('showPrices', v); }} />
                            <CheckboxRow label="Show Percentages" checked={showPercentages} onChange={(v) => { setShowPercentages(v); updateStyle('showPercentages', v); }} />
                            <SelectDropdown label="Label Position" value={labelPosition} options={LABEL_POSITION_OPTIONS} onChange={(v) => { setLabelPosition(v); updateStyle('labelPosition', v); }} />
                            <CheckboxRow label="Log Scale" checked={useLogScale} onChange={(v) => { setUseLogScale(v); updateStyle('logScale', v); }} />
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

            {/* ═══ TEXT TAB ═══════════════════════════════════════════ */}
            {activeTab === 'text' && (
                <div>
                    <FontToolbar
                        color={textColor}
                        onColorChange={applyAndSet(setTextColor, 'textColor')}
                        fontSize={fontSize}
                        onSizeChange={(v) => { setFontSize(v); updateStyle('fontSize', v); }}
                        bold={fontBold}
                        onBoldChange={applyAndSet(setFontBold, 'fontBold')}
                        italic={fontItalic}
                        onItalicChange={applyAndSet(setFontItalic, 'fontItalic')}
                    />
                    <div style={{ margin: '12px 0' }}>
                        <StyledTextArea
                            value={textContent}
                            onChange={(v) => {
                                setTextContent(v);
                                updateStyle('text', v);
                                // Also update meta.text for renderers that use it
                                if (engine) {
                                    const d = engine.drawings.find((d) => d.id === drawing.id);
                                    if (d && d.meta) d.meta.text = v;
                                }
                            }}
                            placeholder="Add text"
                        />
                    </div>
                    <TextAlignmentPicker
                        label="Text alignment"
                        vAlign={textAlignV}
                        hAlign={textAlignH}
                        onVChange={applyAndSet(setTextAlignV, 'textAlignV')}
                        onHChange={applyAndSet(setTextAlignH, 'textAlignH')}
                    />
                </div>
            )}

            {/* ═══ COORDINATES TAB ════════════════════════════════════ */}
            {activeTab === 'coordinates' && (
                <div>
                    {points.map((pt, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 0',
                                borderBottom: i < points.length - 1 ? `1px solid ${C.bd}20` : 'none',
                            }}
                        >
                            <span style={{
                                fontSize: 13,
                                fontFamily: F,
                                color: C.t2,
                                minWidth: 100,
                                whiteSpace: 'nowrap',
                            }}>
                                #{i + 1} (price, bar)
                            </span>
                            <StepperInput
                                value={pt.price}
                                onChange={(v) => handlePointChange(i, 'price', v)}
                                step={pt.price >= 100 ? 1 : 0.01}
                            />
                            <input
                                type="number"
                                value={Math.round((pt.time - new Date('2024-01-01').getTime()) / (1000 * 60 * 60))}
                                onChange={(e) => {
                                    const barIdx = parseInt(e.target.value);
                                    if (!isNaN(barIdx)) {
                                        handlePointChange(i, 'time', new Date('2024-01-01').getTime() + barIdx * 3600000);
                                    }
                                }}
                                style={{
                                    width: 60,
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: `1px solid ${C.bd}`,
                                    background: C.sf,
                                    color: C.t1,
                                    fontFamily: M,
                                    fontSize: 12,
                                    outline: 'none',
                                    textAlign: 'center',
                                }}
                            />
                        </div>
                    ))}

                    {points.length === 0 && (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.t3, fontFamily: F }}>
                            No anchor points for this drawing type.
                        </div>
                    )}
                </div>
            )}

            {/* ═══ VISIBILITY TAB ═════════════════════════════════════ */}
            {activeTab === 'visibility' && (
                <div>
                    <CheckboxRow
                        label="Ticks"
                        checked={visibilityTicks}
                        onChange={(v) => { setVisibilityTicks(v); updateVisibility(); }}
                    />

                    <div style={{ marginTop: 8 }}>
                        {TIMEFRAME_ROWS.map((row) => (
                            <TimeframeVisibilityRow
                                key={row.id}
                                label={row.label}
                                enabled={tfState[row.id]?.enabled}
                                onToggle={(v) => {
                                    setTfState((prev) => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], enabled: v },
                                    }));
                                    updateVisibility();
                                }}
                                min={row.min}
                                max={row.max}
                                rangeMin={tfState[row.id]?.min}
                                rangeMax={tfState[row.id]?.max}
                                onRangeChange={(min, max) => {
                                    setTfState((prev) => ({
                                        ...prev,
                                        [row.id]: { ...prev[row.id], min, max },
                                    }));
                                    updateVisibility();
                                }}
                            />
                        ))}
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <CheckboxRow
                            label="Ranges"
                            checked={visibilityRanges}
                            onChange={(v) => { setVisibilityRanges(v); updateVisibility(); }}
                        />
                    </div>
                </div>
            )}
        </SettingsTabShell>
    );
}

/** Check if a drawing type should show full settings (now returns true for ALL tools) */
DrawingSettingsDialog.isComplexTool = () => true;
