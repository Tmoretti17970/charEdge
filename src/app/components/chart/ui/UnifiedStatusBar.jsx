// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Status Bar (Apple Design Merge)
//
// Single 26px bottom bar replacing both ChartStatusBar + PipelineStatusBar.
// Compact by default; click the health dot to expand pipeline diagnostics.
//
// Compact:  [●] O 67263 · H 67482 · L 67183 · C 67199 | ▼ -0.09% | Vol 530 | 🟢 24/7 | ⏱ 8m 02s | Auto ▼
// Expanded: [● Connected 6.2t/s ▁▂▃ 18ms] + the above
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { C, F, M, getAssetClass } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';
import { formatPrice } from '../../../../charting_library/core/CoordinateSystem.js';
import { tfToMs, formatCountdown } from '../../../../charting_library/core/barCountdown.js';
import { getMarketStatus } from '../../../../utils/marketHours.js';
import { pipelineHealth } from '../../../../data/engine/infra/PipelineHealthMonitor.js';
import { pipelineLogger } from '../../../../data/engine/infra/DataPipelineLogger.js';

// ─── Constants ──────────────────────────────────────────────────

const SCALE_MODES = [
    { id: 'auto', label: 'Auto', icon: 'A' },
    { id: 'log', label: 'Log', icon: 'L' },
    { id: 'pct', label: '%', icon: '%' },
    { id: 'inverted', label: 'Inv', icon: '⇅' },
];

const SPARKLINE_LENGTH = 20;
const UPDATE_INTERVAL = 1000;

const STATUS_COLORS = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    critical: '#ef4444',
    disconnected: '#6b7280',
};

// ─── Helpers ────────────────────────────────────────────────────

function formatVolume(vol) {
    if (!vol || !isFinite(vol)) return '—';
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
    return vol.toFixed(0);
}

function getTickSpeedColor(rate) {
    if (rate >= 50) return '#22c55e';
    if (rate >= 20) return '#5c9cf5';
    if (rate >= 5) return '#f59e0b';
    if (rate > 0) return '#ef4444';
    return '#6b7280';
}

function getTickSpeedLabel(rate) {
    if (rate >= 50) return 'FAST';
    if (rate >= 20) return 'GOOD';
    if (rate >= 5) return 'SLOW';
    if (rate > 0) return 'WEAK';
    return 'IDLE';
}

function getLatencyColor(ms) {
    if (ms <= 50) return '#22c55e';
    if (ms <= 150) return '#f59e0b';
    return '#ef4444';
}

function formatElapsed(ms) {
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    return `${Math.round(ms / 3_600_000)}h ago`;
}

const STALE_THRESHOLD = 60_000;

// ─── Mini Sparkline ─────────────────────────────────────────────

function Sparkline({ data, color, width = 48, height = 12 }) {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data, 1);
    const range = max || 1;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (v / range) * (height - 2) - 1;
        return `${x},${y}`;
    }).join(' ');

    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
            <defs>
                <linearGradient id="usb-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#usb-spark)" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            {data.length > 0 && (() => {
                const lastX = width;
                const lastY = height - (data[data.length - 1] / range) * (height - 2) - 1;
                return (
                    <circle cx={lastX} cy={lastY} r="1.5" fill={color}>
                        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                );
            })()}
        </svg>
    );
}

// ─── Speed Meter Pips ───────────────────────────────────────────

function SpeedMeter({ rate, maxRate = 100 }) {
    const pips = 5;
    const filled = Math.min(pips, Math.ceil((rate / maxRate) * pips));
    const color = getTickSpeedColor(rate);
    const heights = [3, 5, 8, 10, 13];

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 13 }}>
            {heights.map((h, i) => (
                <div
                    key={i}
                    style={{
                        width: 2.5,
                        height: h,
                        borderRadius: 1,
                        backgroundColor: i < filled ? color : 'rgba(148, 163, 184, 0.15)',
                        transition: 'background-color 0.3s',
                    }}
                />
            ))}
        </div>
    );
}

// ─── Unified Status Bar ─────────────────────────────────────────

export default function UnifiedStatusBar({ showPipeline = true, hoveredBar }) {
    // ── Chart data state ──
    const data = useChartStore((s) => s.data);
    const tf = useChartStore((s) => s.tf);
    const symbol = useChartStore((s) => s.symbol);
    const scaleMode = useChartStore((s) => s.scaleMode);
    const setScaleMode = useChartStore((s) => s.setScaleMode);

    const [countdown, setCountdown] = useState('');
    const [scaleOpen, setScaleOpen] = useState(false);
    const [marketStatus, setMarketStatus] = useState(null);
    const [dataAge, setDataAge] = useState(null);
    const scaleRef = useRef(null);

    // ── Pipeline state ──
    const [health, setHealth] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [recentErrors, setRecentErrors] = useState([]);
    const [staleMs, setStaleMs] = useState(0);
    const sparklineRef = useRef([]);
    const lastTickTimeRef = useRef(Date.now());
    const latencyRef = useRef(0);

    // ── Display bar ──
    const displayBar = useMemo(() => {
        if (hoveredBar) return hoveredBar;
        if (data?.length) return data[data.length - 1];
        return null;
    }, [hoveredBar, data]);

    const prevBar = useMemo(() => {
        if (!data?.length) return null;
        if (hoveredBar) {
            const idx = data.indexOf(hoveredBar);
            return idx > 0 ? data[idx - 1] : null;
        }
        return data.length > 1 ? data[data.length - 2] : null;
    }, [hoveredBar, data]);

    const change = useMemo(() => {
        if (!displayBar || !prevBar) return null;
        const diff = displayBar.close - prevBar.close;
        const pct = prevBar.close !== 0 ? (diff / prevBar.close) * 100 : 0;
        return { diff, pct, isUp: diff >= 0 };
    }, [displayBar, prevBar]);

    // ── Bar countdown ──
    useEffect(() => {
        const tfMs = tfToMs(tf);
        if (!tfMs || !data?.length) { setCountdown(''); return; }
        const tick = () => {
            const lastBar = data[data.length - 1];
            if (!lastBar?.time) { setCountdown(''); return; }
            const remaining = lastBar.time + tfMs - Date.now();
            setCountdown(remaining > 0 ? formatCountdown(remaining) : '00:00');
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [tf, data]);

    // ── Scale picker click-outside ──
    useEffect(() => {
        const handler = (e) => {
            if (scaleRef.current && !scaleRef.current.contains(e.target)) setScaleOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Market status + staleness ──
    useEffect(() => {
        const update = () => {
            setMarketStatus(getMarketStatus(symbol));
            if (data?.length) {
                const lastBarTime = data[data.length - 1]?.time;
                setDataAge(lastBarTime ? Date.now() - lastBarTime : null);
            } else {
                setDataAge(null);
            }
        };
        update();
        const id = setInterval(update, 30_000);
        return () => clearInterval(id);
    }, [symbol, data]);

    // ── Pipeline health polling ──
    useEffect(() => {
        if (!showPipeline) return;

        pipelineHealth.start();
        setHealth(pipelineHealth.getHealth());

        // Dev diagnostic — preserved from PipelineStatusBar
        window.__pipelineHealth = pipelineHealth;
        window.__pipelineDiag = () => {
            const h = pipelineHealth.getHealth();
            const spark = sparklineRef.current.slice();
            const table = {
                'Status': h.overall,
                'Tick Rate (t/s)': h.tickRate,
                'Speed Label': getTickSpeedLabel(h.tickRate),
                'Latency EMA (ms)': h.latency,
                'FPS': h.performance.fps,
                'Quality': h.performance.qualityLevel,
                'Connections': h.connections.total,
                'Reconnecting': h.connections.reconnecting,
                'Symbols Persisted': h.persistence.symbols,
                'Errors': h.errors.total,
                'Warnings': h.errors.warnings,
            };
            console.log('%c── Pipeline Diagnostic ──', 'color: #5c9cf5; font-weight: bold; font-size: 13px');
            console.table(table);
            console.log('Connection states:', h.connections.states);
            console.log('Sparkline history (last 20):', spark);
            console.log('Issues:', h.issues.length ? h.issues : '(none)');
            console.log('Full health object:', h);
            return h;
        };

        const unsub = pipelineHealth.onHealthChange((h) => setHealth(h));

        const timer = setInterval(() => {
            const h = pipelineHealth.getHealth();
            setHealth(h);
            if (h) {
                sparklineRef.current = [...sparklineRef.current.slice(-(SPARKLINE_LENGTH - 1)), h.tickRate];
                latencyRef.current = h.latency || 0;
                const now = Date.now();
                if (h.tickRate > 0) lastTickTimeRef.current = now;
                setStaleMs(now - lastTickTimeRef.current);
            }
        }, UPDATE_INTERVAL);

        return () => { unsub(); clearInterval(timer); };
    }, [showPipeline]);

    // ── Error panel toggle ──
    const toggleErrors = useCallback(() => {
        setShowErrors(prev => {
            if (!prev) {
                setRecentErrors(pipelineLogger.getRecent(30, null).filter(
                    e => e.level === 'error' || e.level === 'warn'
                ).reverse());
            }
            return !prev;
        });
    }, []);

    if (!displayBar) return null;

    const currentScaleMode = SCALE_MODES.find((m) => m.id === scaleMode) || SCALE_MODES[0];
    const isUrgent = countdown && !countdown.includes('m') && !countdown.includes('h') &&
        parseInt(countdown) <= 10 && parseInt(countdown) > 0;
    const barIsUp = displayBar.close >= displayBar.open;
    const dirColor = barIsUp ? C.g : C.r;

    // Pipeline derived values
    const statusColor = health ? (STATUS_COLORS[health.overall] || STATUS_COLORS.disconnected) : STATUS_COLORS.disconnected;
    const hasErrors = health ? (health.errors.total > 0 || health.errors.warnings > 0) : false;
    const tickColor = health ? getTickSpeedColor(health.tickRate) : '#6b7280';
    const speedLabel = health ? getTickSpeedLabel(health.tickRate) : 'IDLE';
    const latency = latencyRef.current;
    const latColor = getLatencyColor(latency);

    return (
        <div className="tf-chart-status-bar" id="unified-status-bar">

            {/* ─── Health Dot (pipeline toggle) ─── */}
            {showPipeline && health && (
                <>
                    <button
                        className="tf-status-health-dot"
                        onClick={() => setExpanded(v => !v)}
                        title={expanded ? 'Collapse pipeline diagnostics' : 'Expand pipeline diagnostics'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: expanded ? 5 : 0,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 2px',
                            flexShrink: 0,
                            transition: 'gap 0.2s ease',
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: statusColor,
                                flexShrink: 0,
                                animation: health.overall === 'healthy' ? 'pulse 2s ease-in-out infinite' : 'none',
                                transition: 'background-color 0.3s',
                            }}
                        />
                        {expanded && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                animation: 'tfUnifiedExpand 0.2s ease forwards',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}>
                                <span style={{ color: statusColor, fontWeight: 600, fontSize: 10 }}>
                                    {health.overall === 'healthy' ? 'Connected' :
                                        health.overall === 'degraded' ? 'Degraded' :
                                            health.overall === 'critical' ? 'Critical' : 'Offline'}
                                </span>

                                {/* Speed section */}
                                {health.connections.total > 0 && (
                                    <>
                                        <SpeedMeter rate={health.tickRate} />
                                        <Sparkline data={sparklineRef.current} color={tickColor} width={48} height={12} />
                                        <span style={{ color: tickColor, fontWeight: 600, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                                            {health.tickRate.toFixed(1)}
                                        </span>
                                        <span style={{ fontSize: 8, opacity: 0.6 }}>t/s</span>
                                        <span style={{
                                            fontSize: 8, fontWeight: 700, letterSpacing: '0.5px',
                                            color: tickColor, backgroundColor: `${tickColor}18`,
                                            border: `1px solid ${tickColor}30`, borderRadius: 3, padding: '0px 3px',
                                        }}>
                                            {speedLabel}
                                        </span>
                                    </>
                                )}

                                {/* Latency */}
                                {latency > 0 && (
                                    <>
                                        <span style={{ fontSize: 9, opacity: 0.5 }}>↕</span>
                                        <span style={{ color: latColor, fontWeight: 600, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                                            {latency}ms
                                        </span>
                                    </>
                                )}

                                {/* Persistence */}
                                {health.persistence.enabled && (
                                    <>
                                        <span style={{ fontSize: 9 }}>💾</span>
                                        <span style={{ fontWeight: 600, color: 'var(--tf-t1)', fontSize: 10 }}>{health.persistence.symbols}</span>
                                        <span style={{ fontSize: 8, opacity: 0.5 }}>sym</span>
                                    </>
                                )}

                                {/* FPS */}
                                {health.performance.fps > 0 && (
                                    <>
                                        <span style={{ fontSize: 9 }}>⚡</span>
                                        <span style={{
                                            fontWeight: 600, fontSize: 10,
                                            color: health.performance.fps < 15 ? '#ef4444' :
                                                health.performance.fps < 30 ? '#f59e0b' : 'var(--tf-t1)',
                                        }}>
                                            {health.performance.fps}
                                        </span>
                                        <span style={{ fontSize: 8, opacity: 0.5 }}>FPS</span>
                                    </>
                                )}

                                {/* Quality */}
                                <span style={{ fontSize: 9 }}>🎚️</span>
                                <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--tf-t1)' }}>
                                    {health.performance.qualityLevel}
                                </span>

                                {/* Stale data */}
                                {staleMs >= STALE_THRESHOLD && (
                                    <>
                                        <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>
                                            ⚠ Stale
                                        </span>
                                        <span style={{
                                            fontSize: 8, fontWeight: 700, color: '#f59e0b',
                                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                            border: '1px solid rgba(245, 158, 11, 0.25)',
                                            borderRadius: 3, padding: '0px 3px',
                                        }}>
                                            {formatElapsed(staleMs)}
                                        </span>
                                    </>
                                )}
                            </span>
                        )}
                    </button>
                    <span className="tf-status-dot" />
                </>
            )}

            {/* ─── OHLCV ─── */}
            <span className="tf-status-group">
                <span className="tf-status-label">O</span>
                <span className="tf-status-value" style={{ color: displayBar.open >= (prevBar?.close || 0) ? C.g : C.r }}>
                    {formatPrice(displayBar.open)}
                </span>
            </span>
            <span className="tf-status-dot" />
            <span className="tf-status-group">
                <span className="tf-status-label">H</span>
                <span className="tf-status-value" style={{ color: C.g }}>{formatPrice(displayBar.high)}</span>
            </span>
            <span className="tf-status-dot" />
            <span className="tf-status-group">
                <span className="tf-status-label">L</span>
                <span className="tf-status-value" style={{ color: C.r }}>{formatPrice(displayBar.low)}</span>
            </span>
            <span className="tf-status-dot" />
            <span className="tf-status-group tf-status-close">
                <span className="tf-status-label">C</span>
                <span className="tf-status-value" style={{ color: dirColor, fontWeight: 700, fontSize: 12 }}>
                    {formatPrice(displayBar.close)}
                </span>
            </span>

            {/* ─── Change ─── */}
            {change && (
                <span className="tf-status-change" data-direction={change.isUp ? 'up' : 'down'}>
                    <span className="tf-status-change-arrow">{change.isUp ? '▲' : '▼'}</span>
                    {change.isUp ? '+' : ''}
                    {formatPrice(change.diff)} ({change.pct >= 0 ? '+' : ''}
                    {change.pct.toFixed(2)}%)
                </span>
            )}

            <span className="tf-status-dot" />

            {/* ─── Volume ─── */}
            <span className="tf-status-group">
                <span className="tf-status-label">Vol</span>
                <span className="tf-status-value">{formatVolume(displayBar.volume)}</span>
            </span>

            {/* ─── Market Status ─── */}
            {marketStatus && (
                <span
                    className="tf-status-group"
                    title={`${marketStatus} — ${getAssetClass(symbol)}`}
                    style={{ gap: 3 }}
                >
                    <span style={{ fontSize: 8 }}>
                        {marketStatus === '24/7' ? '🟢' :
                            marketStatus === 'Market Open' ? '🟢' :
                                marketStatus === 'Extended Hours' ? '🟡' : '🔴'}
                    </span>
                    <span className="tf-status-value" style={{
                        color: marketStatus === 'Market Closed' ? C.t3 :
                            marketStatus === 'Extended Hours' ? C.y : C.g,
                        fontSize: 9,
                    }}>
                        {marketStatus === '24/7' ? '24/7' :
                            marketStatus === 'Market Open' ? 'Open' :
                                marketStatus === 'Extended Hours' ? 'Ext' : 'Closed'}
                    </span>
                </span>
            )}

            {/* ─── Data Staleness ─── */}
            {dataAge != null && dataAge > 5 * 60_000 && (
                <span
                    className="tf-status-group"
                    title={`Last data update: ${Math.round(dataAge / 60_000)}m ago`}
                    style={{ gap: 3 }}
                >
                    <span style={{ fontSize: 8 }}>⚠️</span>
                    <span className="tf-status-value" style={{ color: C.y, fontSize: 9 }}>
                        {Math.round(dataAge / 60_000)}m
                    </span>
                </span>
            )}

            {/* ─── Spacer ─── */}
            <div style={{ flex: 1 }} />

            {/* ─── Pipeline Issues (inline) ─── */}
            {expanded && health?.issues?.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', color: statusColor, fontSize: 10, gap: 4 }}>
                    {health.issues.join(' · ')}
                </span>
            )}

            {/* ─── Error Badge ─── */}
            {expanded && hasErrors && (
                <span
                    style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        color: '#ef4444', fontWeight: 600, cursor: 'pointer',
                        position: 'relative', fontSize: 10,
                    }}
                    onClick={toggleErrors}
                    title="Click to view pipeline logs"
                >
                    ⚠ {health.errors.total + health.errors.warnings}
                    {showErrors && (
                        <div
                            style={{
                                position: 'absolute', bottom: 28, right: 0, width: 380, maxHeight: 280,
                                overflow: 'auto',
                                backgroundColor: 'var(--bg-surface-overlay, rgba(15, 23, 42, 0.95))',
                                border: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.2))',
                                borderRadius: 8, padding: 8, fontSize: 10,
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                zIndex: 1000, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: 6, fontWeight: 600, color: '#e2e8f0', fontSize: 11 }}>
                                Pipeline Log
                            </div>
                            {recentErrors.length === 0 && (
                                <div style={{ color: '#64748b', padding: 8 }}>No recent issues</div>
                            )}
                            {recentErrors.map((entry, i) => (
                                <div key={i} style={{
                                    padding: '4px 6px', marginBottom: 2, borderRadius: 4,
                                    backgroundColor: entry.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    color: entry.level === 'error' ? '#fca5a5' : '#fcd34d',
                                    lineHeight: 1.4, wordBreak: 'break-word',
                                }}>
                                    <span style={{ opacity: 0.6 }}>{new Date(entry.ts).toLocaleTimeString()}</span>
                                    {' '}<span style={{ fontWeight: 600 }}>[{entry.source}]</span>
                                    {' '}{entry.message}
                                    {entry.error && (
                                        <div style={{ opacity: 0.7, marginTop: 2 }}>└ {entry.error}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </span>
            )}

            {/* ─── Bar Countdown ─── */}
            {countdown && (
                <span
                    className={isUrgent ? 'tf-countdown-urgent' : ''}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Time until next bar close"
                >
                    <span style={{ fontSize: 10 }}>⏱</span>
                    <span className="tf-status-value">{countdown}</span>
                </span>
            )}

            {/* ─── Scale Mode Picker ─── */}
            <div ref={scaleRef} style={{ position: 'relative' }}>
                <button
                    className="tf-chart-toolbar-btn"
                    data-active={scaleOpen || undefined}
                    onClick={() => setScaleOpen(!scaleOpen)}
                    style={{
                        fontFamily: M,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        gap: 3,
                    }}
                    title="Scale Mode"
                >
                    {currentScaleMode.icon} {currentScaleMode.label}
                    <span style={{ fontSize: 7, marginLeft: 1 }}>▼</span>
                </button>

                {scaleOpen && (
                    <div
                        className="tf-chart-dropdown"
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            right: 0,
                            marginBottom: 6,
                            minWidth: 120,
                            transformOrigin: 'bottom right',
                        }}
                    >
                        {SCALE_MODES.map((mode) => {
                            const isActive = scaleMode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    className="tf-chart-dropdown-item"
                                    data-active={isActive || undefined}
                                    onClick={() => { setScaleMode(mode.id); setScaleOpen(false); }}
                                >
                                    <span style={{ width: 18, textAlign: 'center', fontWeight: 700, flexShrink: 0 }}>{mode.icon}</span>
                                    {mode.label}
                                    {isActive && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
