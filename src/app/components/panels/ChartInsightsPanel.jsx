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
import { anomalyDetector } from '../../../charting_library/ai/AnomalyDetector.js';
import { entryQualityScorer } from '../../../charting_library/ai/EntryQualityScorer.js';
import { featureExtractor } from '../../../charting_library/ai/FeatureExtractor.js';
import { localInsightEngine } from '../../../charting_library/ai/LocalInsightEngine.js';
import { analyzeAll, checkDrawingProximity } from '../../../charting_library/studies/PriceActionEngine.js';
import { C } from '../../../constants.js';
import { useChartFeaturesStore } from '../../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import AILoadingSkeleton from '../design/AILoadingSkeleton.jsx';
import AIOrb from '../design/AIOrb.jsx';
import st from './ChartInsightsPanel.module.css';

function ChartInsightsPanel({ data, isOpen, onClose, onApplyAutoFib, onCreateAlert, symbol, tf }) {
  const drawings = useChartToolsStore((s) => s.drawings);
  const _intelligence = useChartFeaturesStore((s) => s.intelligence);

  const analysis = useMemo(() => {
    if (!data?.length) return null;
    return analyzeAll(data);
  }, [data]);

  const aiAnalysis = useMemo(() => {
    if (!data?.length || data.length < 25) return null;
    try {
      const features = featureExtractor.extract(data);
      return localInsightEngine.generateFullAnalysis(features, symbol || 'Chart', tf || '—', data);
    } catch {
      return null;
    }
  }, [data, symbol, tf]);

  const proximityAlerts = useMemo(() => {
    if (!data?.length || !drawings?.length) return [];
    return checkDrawingProximity(drawings, data[data.length - 1]);
  }, [data, drawings]);

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

  const anomalies = useMemo(() => {
    if (!data?.length || data.length < 30) return [];
    try {
      return anomalyDetector.detectWithContext(data).slice(0, 6);
    } catch {
      return [];
    }
  }, [data]);

  const [mlGrade, setMlGrade] = useState(null);
  useEffect(() => {
    if (!aiAnalysis || !data?.length || data.length < 25) {
      setMlGrade(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const features = featureExtractor.extract(data);
        const result = await entryQualityScorer.score(features.vector);
        if (!cancelled) setMlGrade(result);
      } catch {
        /* graceful degradation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, aiAnalysis]);

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

  if (!analysis && !aiAnalysis) {
    return (
      <div className={st.loadingWrap}>
        <AILoadingSkeleton variant="full" />
      </div>
    );
  }

  const { levels, patterns, swings, autoFib, divergences } = analysis || {};
  const recentPatterns = patterns?.filter((p) => p.idx >= data.length - 20) || [];

  const grade = aiAnalysis?.grade;
  const risk = aiAnalysis?.risk;
  const observations = aiAnalysis?.observations || [];
  const aiSections = aiAnalysis?.sections || [];

  const momentumSection = aiSections.find((s) => s.title === 'Momentum');
  const volumeSection = aiSections.find((s) => s.title === 'Volume');
  const volatilitySection = aiSections.find((s) => s.title === 'Volatility');

  return (
    <div className={st.root}>
      {/* ─── Header ─────────────────────────────────── */}
      <div className={st.header}>
        <div className={st.headerLeft}>
          <AIOrb size={16} state={aiAnalysis ? 'idle' : 'thinking'} />
          <span className={st.headerTitle}>Chart Intelligence</span>
        </div>
        <div className={st.headerRight}>
          {grade && (
            <span
              className={st.gradeBadge}
              style={{ '--grade-color': grade.stars >= 4 ? C.g : grade.stars >= 3 ? C.y : C.r }}
            >
              {grade.letter}
            </span>
          )}
          {mlGrade && mlGrade.source === 'ml' && (
            <span
              className={st.mlBadge}
              title={`ML Grade: ${mlGrade.grade} (${mlGrade.score * 100}%) — ${mlGrade.desc}`}
            >
              ML:{mlGrade.grade}
            </span>
          )}
          {risk && (
            <span className={st.riskEmoji} title={`Risk: ${risk.level} (${risk.score}/100)`}>
              {risk.emoji}
            </span>
          )}
          <button className={`tf-btn ${st.closeBtn}`} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* ─── Key Observations ────── */}
      {observations.length > 0 && (
        <CollapsibleSection
          title={`Key Observations (${observations.length})`}
          color="#e8642c"
          isOpen={!collapsed.observations}
          onToggle={() => toggleSection('observations')}
        >
          {observations.map((obs, i) => (
            <div key={i} className={st.obsRow}>
              <SeverityDot priority={obs.priority} />
              <div className={st.obsText}>{obs.text}</div>
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
          <div className={st.riskWrap}>
            <div className={st.riskBarRow}>
              <div className={st.riskTrack}>
                <div
                  className={st.riskFill}
                  style={{
                    width: `${risk.score}%`,
                    '--risk-color': risk.score >= 50 ? C.r : risk.score >= 25 ? C.y : C.g,
                  }}
                />
              </div>
              <span className={st.riskScore}>{risk.score}/100</span>
            </div>
            {risk.risks.map((r, i) => (
              <div key={i} className={st.riskItem}>
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
            <div key={i} className={st.levelRow}>
              <TypeBadge type={level.type} />
              <div style={{ flex: 1 }}>
                <div className={st.levelPrice}>{level.price.toFixed(2)}</div>
                <div className={st.levelMeta}>
                  {level.touches} touches · {level.distancePct}% away
                </div>
              </div>
              <StrengthBar strength={level.strength} maxStrength={Math.max(...levels.map((l) => l.strength))} />
              {onCreateAlert && (
                <button
                  className={`tf-btn ${st.alertLevelBtn}`}
                  onClick={() => onCreateAlert(level)}
                  title="Create alert at this level"
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
            <div key={i} className={st.patRow}>
              <span className={st.patIcon}>{pat.icon}</span>
              <div className={st.patBody}>
                <div className={st.patName}>{pat.label}</div>
                <div className={st.patMeta}>
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
          {aiPatterns.candlestick.length > 0 && (
            <>
              <div className={st.subGroupLabel}>Candlestick</div>
              {aiPatterns.candlestick.map((p, i) => (
                <PatternRow key={`cs-${i}`} emoji={p.emoji} name={p.name} type={p.type} desc={p.desc} />
              ))}
            </>
          )}
          {aiPatterns.chart.length > 0 && (
            <>
              <div className={st.subGroupLabel}>Formations</div>
              {aiPatterns.chart.map((p, i) => (
                <PatternRow
                  key={`ch-${i}`}
                  emoji={p.icon}
                  name={p.label}
                  type={p.bias}
                  desc={p.desc}
                  confidence={p.confidence}
                />
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
            <div key={i} className={st.anomalyRow}>
              <div className={st.anomalyHeader}>
                <span
                  className={st.anomalyDot}
                  style={{ '--dot-color': a.severity === 'high' ? C.r : a.severity === 'medium' ? '#f59e0b' : C.t3 }}
                />
                <span className={st.anomalyName}>
                  {a.type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span className={st.anomalyZ}>{a.zScore.toFixed(1)}σ</span>
              </div>
              <div className={st.anomalyDesc}>{a.description}</div>
              {a.historicalContext && a.historicalContext.similar > 0 && (
                <div className={st.anomalyCtx}>📊 {a.historicalContext.narrative}</div>
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
            <div key={i} className={st.divRow}>
              <span className={st.divIcon} style={{ color: div.type === 'bullish' ? C.g : C.r }}>
                {div.type === 'bullish' ? '↗' : '↘'}
              </span>
              <div className={st.divBody}>
                <div className={st.divName}>{div.type === 'bullish' ? 'Bullish' : 'Bearish'} Divergence</div>
                <div className={st.divMeta}>
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
          <div className={st.fibWrap}>
            <div className={st.fibInfo}>
              Swing {swings?.direction === 'up' ? '↑ Up' : '↓ Down'}:{' '}
              <span className={st.fibMono}>
                {swings.swingLow.price.toFixed(2)} → {swings.swingHigh.price.toFixed(2)}
              </span>
            </div>
            {onApplyAutoFib && (
              <button className={`tf-btn ${st.fibBtn}`} onClick={() => onApplyAutoFib(autoFib)}>
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
            <div key={i} className={st.drawingRow}>
              <span className={st.drawingIcon}>⚠</span>
              <div className={st.drawingText}>
                Price {alert.direction} <strong>{alert.drawingType}</strong> at{' '}
                <span className={st.drawingMono}>{alert.level.toFixed(2)}</span>
                <span className={st.drawingDist}> ({alert.distancePct}%)</span>
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* ─── Volatility (footer) ─────────────────────── */}
      {volatilitySection && (
        <div className={st.volFooter}>
          <span className={st.volLabel}>Vol: </span>
          {volatilitySection.content}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function CollapsibleSection({ title, color, children, isOpen, onToggle }) {
  return (
    <div className={st.section}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={st.sectionHeader}
        style={{ '--section-color': color }}
      >
        <span>{title}</span>
        <span className={`${st.sectionChevron} ${!isOpen ? st.sectionChevronClosed : ''}`}>▾</span>
      </div>
      {isOpen && children}
    </div>
  );
}

function InsightBlock({ content, detail }) {
  return (
    <div className={st.insightWrap}>
      <div className={st.insightContent}>{content}</div>
      {detail && <div className={st.insightDetail}>{detail}</div>}
    </div>
  );
}

function SeverityDot({ priority }) {
  const color = priority >= 8 ? C.r : priority >= 6 ? C.y : C.info;
  return <span className={st.sevDot} style={{ '--dot-color': color }} />;
}

function Empty({ children }) {
  return <div className={st.empty}>{children}</div>;
}

function TypeBadge({ type }) {
  const colors = {
    support: { bg: C.g, label: 'S' },
    resistance: { bg: C.r, label: 'R' },
    both: { bg: C.y, label: 'SR' },
  };
  const c = colors[type] || colors.both;
  return (
    <span className={st.typeBadge} style={{ '--badge-color': c.bg }}>
      {c.label}
    </span>
  );
}

function PatternRow({ emoji, name, type, desc, confidence }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = type === 'bullish' ? C.g : type === 'bearish' ? C.r : C.y;
  return (
    <div onClick={() => setExpanded(!expanded)} className={`${st.patRow} ${st.patRowClickable}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={st.patIcon}>{emoji}</span>
        <div className={st.patBody}>
          <div className={st.patName}>{name}</div>
          {confidence != null && <div className={st.patMetaMono}>{Math.round(confidence * 100)}% confidence</div>}
        </div>
        <span className={st.biasBadge} style={{ '--badge-color': typeColor }}>
          {type}
        </span>
      </div>
      {expanded && desc && <div className={st.patDesc}>{desc}</div>}
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
    <span className={st.biasBadge} style={{ '--badge-color': colors[bias] || C.t3 }}>
      {bias}
    </span>
  );
}

function StrengthBar({ strength, maxStrength }) {
  const pct = maxStrength > 0 ? strength / maxStrength : 0;
  const barColor = pct > 0.7 ? C.g : pct > 0.4 ? C.y : C.t3;
  return (
    <div className={st.strengthTrack}>
      <div className={st.strengthFill} style={{ width: `${Math.round(pct * 100)}%`, '--bar-color': barColor }} />
    </div>
  );
}

export { ChartInsightsPanel };

export default React.memo(ChartInsightsPanel);
