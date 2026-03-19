// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Chart Insights Panel (Sprint 1 UI)
//
// Sidebar showing auto-detected price intelligence, now powered
// by LocalInsightEngine v2 for rich multi-section analysis.
//
// Sections:
//   1. Header — grade badge + risk indicator
//   2. Key Observations (prioritized, top of panel)
//   3. Risk Assessment — score bar + risk factors
//   4. Momentum — deep RSI/MACD/EMA interpretation
//   5. Volume — buy/sell pressure, OBV, spikes
//   6. Support/Resistance levels with strength bars
//   7. Candlestick patterns with bias indicators
//   8. Divergences (RSI, volume, MACD)
//   9. Auto-Fib status
//  10. Drawing proximity alerts
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { analyzeAll, checkDrawingProximity } from '../../../charting_library/studies/PriceActionEngine.js';
import { localInsightEngine } from '../../../charting_library/ai/LocalInsightEngine.js';
import { featureExtractor } from '../../../charting_library/ai/FeatureExtractor.js';
import { anomalyDetector } from '../../../charting_library/ai/AnomalyDetector.js';
import { entryQualityScorer } from '../../../charting_library/ai/EntryQualityScorer.js';
import { C, F, M } from '../../../constants.js';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../../state/chart/useChartFeaturesStore';
import AIOrb from '../design/AIOrb.jsx';
import AILoadingSkeleton from '../design/AILoadingSkeleton.jsx';

/**
 * @param {Array} data - OHLCV data
 * @param {boolean} isOpen - Panel visibility
 * @param {Function} onClose - Close handler
 * @param {Function} onApplyAutoFib - Callback to add auto-fib drawing
 * @param {Function} onCreateAlert - Callback to create alert from S/R level
 * @param {string} symbol - Current trading symbol
 * @param {string} tf - Current timeframe
 */
function ChartInsightsPanel({ data, isOpen, onClose, onApplyAutoFib, onCreateAlert, symbol, tf }) {
  const drawings = useChartToolsStore((s) => s.drawings);
  const _intelligence = useChartFeaturesStore((s) => s.intelligence);

  // Run PriceActionEngine analysis (existing — S/R, patterns, fib, etc.)
  const analysis = useMemo(() => {
    if (!data?.length) return null;
    return analyzeAll(data);
  }, [data]);

  // Run LocalInsightEngine v2 full analysis (NEW — momentum, volume, risk, observations)
  const aiAnalysis = useMemo(() => {
    if (!data?.length || data.length < 25) return null;
    try {
      const features = featureExtractor.extract(data);
      return localInsightEngine.generateFullAnalysis(features, symbol || 'Chart', tf || '—', data);
    } catch {
      return null;
    }
  }, [data, symbol, tf]);

  // Drawing proximity check
  const proximityAlerts = useMemo(() => {
    if (!data?.length || !drawings?.length) return [];
    return checkDrawingProximity(drawings, data[data.length - 1]);
  }, [data, drawings]);

  // AI candlestick + chart pattern detection
  const aiPatterns = useMemo(() => {
    if (!data?.length || data.length < 30) return { candlestick: [], chart: [] };
    try {
      const candlestick = localInsightEngine.detectPatterns?.(data) ?? [];
      const chart = localInsightEngine.detectChartPatterns?.(data) ?? [];
      return { candlestick, chart };
    } catch {
      return { candlestick: [], chart: [] };
    }
  }, [data]);

  // Anomaly detection with historical context
  const anomalies = useMemo(() => {
    if (!data?.length || data.length < 30) return [];
    try {
      return anomalyDetector.detectWithContext(data).slice(0, 6);
    } catch {
      return [];
    }
  }, [data]);

  // ML Entry Quality Score (Sprint 45)
  const [mlGrade, setMlGrade] = useState(null);
  useEffect(() => {
    if (!aiAnalysis || !data?.length || data.length < 25) { setMlGrade(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const features = featureExtractor.extract(data);
        const result = await entryQualityScorer.score(features.vector);
        if (!cancelled) setMlGrade(result);
      } catch { /* graceful degradation */ }
    })();
    return () => { cancelled = true; };
  }, [data, aiAnalysis]);

  // Section collapse state
  const [collapsed, setCollapsed] = useState({
    observations: false,
    risk: false,
    momentum: true,
    volume: true,
    levels: false,
    patterns: false,
    aiPatterns: false,
    anomalies: false,
    divergences: false,
    fib: true,
    drawingAlerts: false,
  });

  const toggleSection = useCallback((key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!isOpen) return null;

  // Show loading skeleton while data is insufficient
  if (!analysis && !aiAnalysis) {
    return (
      <div style={{ width: 260, background: C.bg, borderLeft: `1px solid ${C.bd}`, padding: 16 }}>
        <AILoadingSkeleton variant="full" />
      </div>
    );
  }

  const { levels, patterns, swings, autoFib, divergences } = analysis || {};
  const recentPatterns = patterns?.filter((p) => p.idx >= data.length - 20) || [];

  // AI analysis data
  const grade = aiAnalysis?.grade;
  const risk = aiAnalysis?.risk;
  const observations = aiAnalysis?.observations || [];
  const aiSections = aiAnalysis?.sections || [];

  // Extract specific sections from AI analysis
  const momentumSection = aiSections.find((s) => s.title === 'Momentum');
  const volumeSection = aiSections.find((s) => s.title === 'Volume');
  const volatilitySection = aiSections.find((s) => s.title === 'Volatility');

  return (
    <div
      style={{
        width: 260,
        background: C.bg,
        borderLeft: `1px solid ${C.bd}`,
        overflowY: 'auto',
        flexShrink: 0,
        fontSize: 12,
        fontFamily: F,
      }}
    >
      {/* ─── Header ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AIOrb size={16} state={aiAnalysis ? 'idle' : 'thinking'} />
          <span style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>Chart Intelligence</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Grade badge */}
          {grade && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                fontFamily: M,
                padding: '2px 6px',
                borderRadius: 4,
                background: grade.stars >= 4 ? `${C.g}20` : grade.stars >= 3 ? `${C.y}20` : `${C.r}20`,
                color: grade.stars >= 4 ? C.g : grade.stars >= 3 ? C.y : C.r,
              }}
            >
              {grade.letter}
            </span>
          )}
          {/* ML grade badge (Sprint 45) */}
          {mlGrade && mlGrade.source === 'ml' && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                fontFamily: M,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#6e5ce620',
                color: '#6e5ce6',
              }}
              title={`ML Grade: ${mlGrade.grade} (${mlGrade.score * 100}%) — ${mlGrade.desc}`}
            >
              ML:{mlGrade.grade}
            </span>
          )}
          {/* Risk badge */}
          {risk && (
            <span style={{ fontSize: 12 }} title={`Risk: ${risk.level} (${risk.score}/100)`}>
              {risk.emoji}
            </span>
          )}
          <button
            className="tf-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── Key Observations (highest priority) ────── */}
      {observations.length > 0 && (
        <CollapsibleSection
          title={`Key Observations (${observations.length})`}
          color="#e8642c"
          isOpen={!collapsed.observations}
          onToggle={() => toggleSection('observations')}
        >
          {observations.map((obs, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '5px 12px',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <SeverityDot priority={obs.priority} />
              <div style={{ flex: 1, fontSize: 11, color: C.t1, lineHeight: 1.4 }}>
                {obs.text}
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ─── Risk Assessment ────────────────────────── */}
      {risk && (
        <CollapsibleSection
          title={`Risk ${risk.emoji} ${risk.level}`}
          color={risk.score >= 50 ? C.r : risk.score >= 25 ? C.y : C.g}
          isOpen={!collapsed.risk}
          onToggle={() => toggleSection('risk')}
        >
          {/* Risk score bar */}
          <div style={{ padding: '4px 12px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 999,
                  background: C.bd,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${risk.score}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: risk.score >= 50 ? C.r : risk.score >= 25 ? C.y : C.g,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, fontFamily: M, fontWeight: 700, color: C.t2 }}>
                {risk.score}/100
              </span>
            </div>
            {risk.risks.map((r, i) => (
              <div key={i} style={{ fontSize: 10, color: C.t2, padding: '2px 0', lineHeight: 1.3 }}>
                ⚠ {r}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ─── Momentum ────────────────────────────────── */}
      {momentumSection && (
        <CollapsibleSection
          title="Momentum"
          color="#a855f7"
          isOpen={!collapsed.momentum}
          onToggle={() => toggleSection('momentum')}
        >
          <InsightBlock content={momentumSection.content} detail={momentumSection.detail} />
        </CollapsibleSection>
      )}

      {/* ─── Volume ──────────────────────────────────── */}
      {volumeSection && (
        <CollapsibleSection
          title="Volume"
          color="#22d3ee"
          isOpen={!collapsed.volume}
          onToggle={() => toggleSection('volume')}
        >
          <InsightBlock content={volumeSection.content} detail={volumeSection.detail} />
        </CollapsibleSection>
      )}

      {/* ─── S/R Levels ──────────────────────────────── */}
      <CollapsibleSection
        title={`Support/Resistance (${levels?.length || 0})`}
        color="#f59e0b"
        isOpen={!collapsed.levels}
        onToggle={() => toggleSection('levels')}
      >
        {!levels?.length ? (
          <Empty>No significant levels detected</Empty>
        ) : (
          levels.map((level, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <TypeBadge type={level.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontFamily: M, color: C.t1, fontSize: 12 }}>
                  {level.price.toFixed(2)}
                </div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  {level.touches} touches · {level.distancePct}% away
                </div>
              </div>
              <StrengthBar strength={level.strength} maxStrength={Math.max(...levels.map((l) => l.strength))} />
              {onCreateAlert && (
                <button
                  className="tf-btn"
                  onClick={() => onCreateAlert(level)}
                  title="Create alert at this level"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: C.t3,
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '2px 4px',
                  }}
                >
                  🔔
                </button>
              )}
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* ─── Candlestick Patterns ────────────────────── */}
      <CollapsibleSection
        title={`Patterns (${recentPatterns.length})`}
        color="#a855f7"
        isOpen={!collapsed.patterns}
        onToggle={() => toggleSection('patterns')}
      >
        {recentPatterns.length === 0 ? (
          <Empty>No patterns in last 20 bars</Empty>
        ) : (
          recentPatterns.slice(0, 8).map((pat, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <span style={{ fontSize: 14 }}>{pat.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.t1, fontSize: 11 }}>{pat.label}</div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  Bar {pat.idx} · {Math.round(pat.confidence * 100)}% confidence
                </div>
              </div>
              <BiasBadge bias={pat.bias} />
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* ─── AI Candlestick + Chart Patterns ────────── */}
      {(aiPatterns.candlestick.length > 0 || aiPatterns.chart.length > 0) && (
        <CollapsibleSection
          title={`AI Patterns (${aiPatterns.candlestick.length + aiPatterns.chart.length})`}
          color="#6e5ce6"
          isOpen={!collapsed.aiPatterns}
          onToggle={() => toggleSection('aiPatterns')}
        >
          {/* Candlestick sub-group */}
          {aiPatterns.candlestick.length > 0 && (
            <>
              <div style={{ padding: '4px 12px 2px', fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Candlestick
              </div>
              {aiPatterns.candlestick.map((p, i) => (
                <PatternRow key={`cs-${i}`} emoji={p.emoji} name={p.name} type={p.type} desc={p.desc} />
              ))}
            </>
          )}
          {/* Chart formations sub-group */}
          {aiPatterns.chart.length > 0 && (
            <>
              <div style={{ padding: '4px 12px 2px', fontSize: 8, fontWeight: 700, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Formations
              </div>
              {aiPatterns.chart.map((p, i) => (
                <PatternRow key={`ch-${i}`} emoji={p.icon} name={p.label} type={p.bias} desc={p.desc} confidence={p.confidence} />
              ))}
            </>
          )}
        </CollapsibleSection>
      )}

      {/* ─── Anomalies with Historical Context ─────── */}
      {anomalies.length > 0 && (
        <CollapsibleSection
          title={`Anomalies (${anomalies.length})`}
          color="#f43f5e"
          isOpen={!collapsed.anomalies}
          onToggle={() => toggleSection('anomalies')}
        >
          {anomalies.map((a, i) => (
            <div
              key={i}
              style={{
                padding: '6px 12px',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{
                  fontSize: 7, width: 7, height: 7, borderRadius: '50%',
                  background: a.severity === 'high' ? C.r : a.severity === 'medium' ? '#f59e0b' : C.t3,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.t1, flex: 1 }}>
                  {a.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span style={{ fontSize: 9, fontFamily: M, fontWeight: 700, color: C.t2 }}>
                  {a.zScore.toFixed(1)}σ
                </span>
              </div>
              <div style={{ fontSize: 10, color: C.t2, lineHeight: 1.3, marginBottom: 3 }}>
                {a.description}
              </div>
              {a.historicalContext && a.historicalContext.similar > 0 && (
                <div style={{
                  fontSize: 9, color: '#6e5ce6', fontFamily: M, fontWeight: 600,
                  padding: '3px 6px', background: '#6e5ce610', borderRadius: 4,
                  marginTop: 2,
                }}>
                  📊 {a.historicalContext.narrative}
                </div>
              )}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ─── Divergences ─────────────────────────────── */}
      <CollapsibleSection
        title={`Divergences (${divergences?.length || 0})`}
        color={C.info}
        isOpen={!collapsed.divergences}
        onToggle={() => toggleSection('divergences')}
      >
        {!divergences?.length ? (
          <Empty>No RSI divergences detected</Empty>
        ) : (
          divergences.slice(-4).map((div, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <span style={{ fontSize: 14, color: div.type === 'bullish' ? C.g : C.r }}>
                {div.type === 'bullish' ? '↗' : '↘'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.t1, fontSize: 11 }}>
                  {div.type === 'bullish' ? 'Bullish' : 'Bearish'} Divergence
                </div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  Bars {div.startIdx}–{div.endIdx} · RSI {div.rsiStart.toFixed(0)}→{div.rsiEnd.toFixed(0)}
                </div>
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* ─── Auto-Fib ────────────────────────────────── */}
      <CollapsibleSection
        title="Auto Fibonacci"
        color="#22c55e"
        isOpen={!collapsed.fib}
        onToggle={() => toggleSection('fib')}
      >
        {autoFib ? (
          <div style={{ padding: '6px 12px' }}>
            <div style={{ fontSize: 11, color: C.t2, marginBottom: 6 }}>
              Swing {swings?.direction === 'up' ? '↑ Up' : '↓ Down'}:{' '}
              <span style={{ fontFamily: M, fontWeight: 700 }}>
                {swings.swingLow.price.toFixed(2)} → {swings.swingHigh.price.toFixed(2)}
              </span>
            </div>
            {onApplyAutoFib && (
              <button
                className="tf-btn"
                onClick={() => onApplyAutoFib(autoFib)}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  borderRadius: 6,
                  border: `1px solid #22c55e40`,
                  background: '#22c55e15',
                  color: C.g,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: M,
                }}
              >
                Apply Auto-Fib to Chart
              </button>
            )}
          </div>
        ) : (
          <Empty>No clear swing structure detected</Empty>
        )}
      </CollapsibleSection>

      {/* ─── Drawing Alerts ──────────────────────────── */}
      {proximityAlerts.length > 0 && (
        <CollapsibleSection
          title={`Drawing Alerts (${proximityAlerts.length})`}
          color="#ec4899"
          isOpen={!collapsed.drawingAlerts}
          onToggle={() => toggleSection('drawingAlerts')}
        >
          {proximityAlerts.map((alert, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                background: '#ec489910',
                borderBottom: `1px solid ${C.bd}15`,
              }}
            >
              <span style={{ color: C.pink, fontSize: 12 }}>⚠</span>
              <div style={{ flex: 1, fontSize: 10, color: C.t2 }}>
                Price {alert.direction} <strong>{alert.drawingType}</strong> at{' '}
                <span style={{ fontFamily: M }}>{alert.level.toFixed(2)}</span>
                <span style={{ color: C.t3 }}> ({alert.distancePct}%)</span>
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ─── Volatility (footer) ─────────────────────── */}
      {volatilitySection && (
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.bd}`, fontSize: 10, color: C.t3 }}>
          <span style={{ fontWeight: 600 }}>Vol: </span>
          {volatilitySection.content}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function CollapsibleSection({ title, color, children, isOpen, onToggle }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.bd}` }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          fontSize: 10,
          fontWeight: 700,
          color: color || C.t3,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontFamily: M,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s ease',
        }}
      >
        <span>{title}</span>
        <span
          style={{
            fontSize: 9,
            color: C.t3,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          ▾
        </span>
      </div>
      {isOpen && children}
    </div>
  );
}

function InsightBlock({ content, detail }) {
  return (
    <div style={{ padding: '4px 12px 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, marginBottom: 4, lineHeight: 1.4 }}>
        {content}
      </div>
      {detail && (
        <div style={{ fontSize: 10, color: C.t2, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function SeverityDot({ priority }) {
  const color = priority >= 8 ? C.r : priority >= 6 ? C.y : C.info;
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  );
}

function Empty({ children }) {
  return <div style={{ padding: '8px 12px', fontSize: 10, color: C.t3, fontStyle: 'italic' }}>{children}</div>;
}

function TypeBadge({ type }) {
  const colors = {
    support: { bg: C.g, label: 'S' },
    resistance: { bg: C.r, label: 'R' },
    both: { bg: C.y, label: 'SR' },
  };
  const c = colors[type] || colors.both;
  return (
    <span
      style={{
        background: c.bg + '20',
        color: c.bg,
        fontSize: 8,
        fontWeight: 800,
        fontFamily: M,
        padding: '2px 4px',
        borderRadius: 3,
        minWidth: 16,
        textAlign: 'center',
      }}
    >
      {c.label}
    </span>
  );
}

function PatternRow({ emoji, name, type, desc, confidence }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = type === 'bullish' ? C.g : type === 'bearish' ? C.r : C.y;
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '5px 12px',
        borderBottom: `1px solid ${C.bd}15`,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: C.t1, fontSize: 11 }}>{name}</div>
          {confidence != null && (
            <div style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>
              {Math.round(confidence * 100)}% confidence
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 8, fontWeight: 700, fontFamily: M,
            color: typeColor, padding: '2px 5px', borderRadius: 3,
            background: typeColor + '15', textTransform: 'uppercase',
          }}
        >
          {type}
        </span>
      </div>
      {expanded && desc && (
        <div style={{ fontSize: 10, color: C.t2, lineHeight: 1.4, marginTop: 4, paddingLeft: 22 }}>
          {desc}
        </div>
      )}
    </div>
  );
}

function BiasBadge({ bias }) {
  const colors = {
    bullish: C.g,
    bearish: C.r,
    neutral: C.y,
    trend: C.info,
  };
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        fontFamily: M,
        color: colors[bias] || C.t3,
        padding: '2px 5px',
        borderRadius: 3,
        background: (colors[bias] || C.t3) + '15',
        textTransform: 'uppercase',
      }}
    >
      {bias}
    </span>
  );
}

function StrengthBar({ strength, maxStrength }) {
  const pct = maxStrength > 0 ? strength / maxStrength : 0;
  return (
    <div
      style={{
        width: 30,
        height: 4,
        borderRadius: 2,
        background: C.bd,
      }}
    >
      <div
        style={{
          width: `${Math.round(pct * 100)}%`,
          height: '100%',
          borderRadius: 2,
          background: pct > 0.7 ? C.g : pct > 0.4 ? C.y : C.t3,
        }}
      />
    </div>
  );
}

export { ChartInsightsPanel };

export default React.memo(ChartInsightsPanel);
