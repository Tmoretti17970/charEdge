// ═══════════════════════════════════════════════════════════════════
// charEdge — Internal Telemetry Dashboard
//
// Hidden dev page accessible via ⌘K → "Telemetry" or by setting
// page to 'telemetry' in the URL/store. Shows all simplification
// metrics: session duration, page distribution, feature activation,
// click heatmap, time-to-first-action, and retention indicators.
//
// This is NOT user-facing — it's for internal dev use only.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect, useCallback } from 'react';
import { StressTest } from '../charting_library/perf/StressTest.js';
import { C, F, M } from '../constants.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore';
import { getAuditSummary, getPlatformCLS, getPhase5Summary, SIMPLIFICATION_MANIFESTO } from '@/a11y/cognitiveLoadAudit';
import { logger } from '@/observability/logger';
import s from './TelemetryDashboard.module.css';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: M, color: accent || C.t1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>{sub}</div>}
    </div>
  );
}

function RankTable({ title, data, labelKey, countKey }) {
  if (!data || data.length === 0) return null;
  const max = data[0]?.[countKey] || 1;

  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
      flex: 1,
      minWidth: 260,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12 }}>
        {title}
      </div>
      <div className={s.s0}>
        {data.slice(0, 10).map((item, i) => (
          <div key={item[labelKey]} className={s.s1}>
            <div style={{ width: 16, fontSize: 10, color: C.t3, fontFamily: M, textAlign: 'right' }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div className={s.s2}>
                <span style={{ fontSize: 12, fontFamily: M, color: C.t1, fontWeight: 500 }}>
                  {item[labelKey]}
                </span>
                <span style={{ fontSize: 11, fontFamily: M, color: C.t3 }}>
                  {item[countKey]}
                </span>
              </div>
              <div style={{
                height: 3,
                borderRadius: 2,
                background: C.bd,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(item[countKey] / max) * 100}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.b}, ${C.b}80)`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyChart({ dailyMinutes }) {
  const days = useMemo(() => {
    const entries = Object.entries(dailyMinutes || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    return entries;
  }, [dailyMinutes]);

  if (days.length === 0) return null;

  const maxMin = Math.max(...days.map(([, m]) => m), 1);

  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12 }}>
        Daily Active Minutes (last 14 days)
      </div>
      <div className={s.s3}>
        {days.map(([day, mins]) => (
          <div key={day} className={s.s4}>
            <div style={{
              width: '100%',
              height: Math.max(4, (mins / maxMin) * 68),
              borderRadius: 3,
              background: `linear-gradient(to top, ${C.b}, ${C.b}60)`,
              transition: 'height 0.3s ease',
            }} />
            <div style={{ fontSize: 8, color: C.t3, fontFamily: M }}>
              {day.slice(5)} {/* MM-DD */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TelemetryDashboard() {
  const kpis = useAnalyticsStore((s) => s.kpis);
  const pageViews = useAnalyticsStore((s) => s.pageViews);
  const _featureUsage = useAnalyticsStore((s) => s.featureUsage);
  const clickMap = useAnalyticsStore((s) => s.clickMap);
  const workflows = useAnalyticsStore((s) => s.workflows);
  const sessions = useAnalyticsStore((s) => s.sessions);
  const reset = useAnalyticsStore((s) => s.reset);

  const clickData = useMemo(() =>
    Object.entries(clickMap || {})
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count),
    [clickMap],
  );

  const workflowData = useMemo(() =>
    Object.entries(workflows || {})
      .map(([workflow, count]) => ({ workflow, count }))
      .sort((a, b) => b.count - a.count),
    [workflows],
  );

  return (
    <div style={{
      padding: 32,
      maxWidth: 1000,
      fontFamily: F,
      overflowY: 'auto',
      height: '100%',
    }}>
      {/* Header */}
      <div className={s.s5}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.t1, margin: 0 }}>
            📊 Telemetry Dashboard
          </h1>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
            Internal metrics for simplification strategy — Sprint 1
          </div>
        </div>
        <button
          onClick={reset}
          className="tf-btn"
          style={{
            fontSize: 11,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            color: C.t3,
            cursor: 'pointer',
            fontFamily: M,
          }}
        >
          Reset Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className={s.s6}>
        <MetricCard
          label="Avg Session"
          value={formatDuration(kpis.avgSessionDuration)}
          sub={`${kpis.totalSessions} total sessions`}
          accent={C.g}
        />
        <MetricCard
          label="Time to First Action"
          value={formatDuration(kpis.avgTimeToFirstAction)}
          sub="Lower is better"
          accent={kpis.avgTimeToFirstAction < 30000 ? C.g : C.r}
        />
        <MetricCard
          label="Page Views"
          value={kpis.totalPageViews.toLocaleString()}
          sub={`across ${Object.keys(pageViews).length} pages`}
        />
        <MetricCard
          label="Feature Uses"
          value={kpis.totalFeatureUses.toLocaleString()}
          sub={`${(kpis.topFeatures || []).length} unique features`}
          accent={C.b}
        />
      </div>

      {/* Daily Activity Chart */}
      <div style={{ marginBottom: 20 }}>
        <DailyChart dailyMinutes={kpis.dailyActiveMinutes} />
      </div>

      {/* Rankings */}
      <div className={s.s7}>
        <RankTable title="Top Pages" data={kpis.topPages} labelKey="page" countKey="count" />
        <RankTable title="Top Features" data={kpis.topFeatures} labelKey="feature" countKey="count" />
      </div>

      <div className={s.s8}>
        <RankTable title="Click Map" data={clickData} labelKey="target" countKey="count" />
        <RankTable title="Workflows" data={workflowData} labelKey="workflow" countKey="count" />
      </div>

      {/* Recent Sessions */}
      <div style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12 }}>
          Recent Sessions ({sessions.length})
        </div>
        <div className={s.s9}>
          {sessions.slice(-10).reverse().map((s, i) => (
            <div key={s.id || i} style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 6,
              background: i % 2 === 0 ? 'transparent' : `${C.bd}15`,
              fontSize: 11,
              fontFamily: M,
              color: C.t2,
            }}>
              <span style={{ color: C.t3, width: 80 }}>
                {s.start ? new Date(s.start).toLocaleDateString() : '—'}
              </span>
              <span style={{ width: 70 }}>{formatDuration(s.duration)}</span>
              <span style={{ width: 90, color: s.firstActionMs < 30000 ? C.g : C.t3 }}>
                TTFA: {formatDuration(s.firstActionMs)}
              </span>
              <span style={{ flex: 1, color: C.t3 }}>
                {(s.pageSequence || []).slice(0, 5).join(' → ')}{(s.pageSequence || []).length > 5 ? '…' : ''}
              </span>
              <span style={{ color: C.t3, width: 100, fontSize: 10 }}>{s.viewport || '—'}</span>
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ fontSize: 12, color: C.t3, textAlign: 'center', padding: 16 }}>
              No sessions recorded yet. Use the app for a bit and check back.
            </div>
          )}
        </div>
      </div>

      {/* ─── Cognitive Load Audit ─────────────────────── */}
      <div style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}>
        <div className={s.s10}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>🧠 Cognitive Load Audit</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>Sprint 4 — Screen complexity scores (1-10)</div>
          </div>
          {(() => {
            const p = getPlatformCLS();
            return (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: M, color: p.current > 7 ? '#ef4444' : p.current > 5 ? '#f59e0b' : '#10b981' }}>
                  {p.current}
                </div>
                <div style={{ fontSize: 10, color: C.t3 }}>Platform avg → {p.target} ({p.reduction}% reduction)</div>
              </div>
            );
          })()}
        </div>
        <div className={s.s11}>
          {getAuditSummary().map((a) => {
            const barColor = a.currentScore > 7 ? '#ef4444' : a.currentScore > 5 ? '#f59e0b' : '#10b981';
            return (
              <div key={a.id} className={s.s12}>
                <div style={{ width: 140, fontSize: 11, fontFamily: M, color: C.t2, flexShrink: 0 }}>{a.name}</div>
                <div className={s.s13}>
                  {/* Current bar */}
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.bd, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${a.currentScore * 10}%`, height: '100%', borderRadius: 4, background: barColor, transition: 'width 0.3s' }} />
                    {/* Target marker */}
                    <div style={{ position: 'absolute', top: 0, left: `${a.targetScore * 10}%`, width: 2, height: '100%', background: '#10b981', borderRadius: 1 }} />
                  </div>
                  <div style={{ width: 36, fontSize: 11, fontWeight: 700, fontFamily: M, color: barColor, textAlign: 'right' }}>{a.currentScore}</div>
                  <div style={{ fontSize: 10, color: '#10b981', fontFamily: M, width: 24, textAlign: 'right' }}>→{a.targetScore}</div>
                  <div style={{ fontSize: 9, color: C.t3, fontFamily: M, width: 36, textAlign: 'right' }}>-{a.reduction}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Sprint 24: Phase 5 Impact ───────────────────── */}
      {(() => {
        const p5 = getPhase5Summary();
        return (
          <div style={{
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 12 }}>
              ✨ Phase 5 Impact — Polish & Measurement
            </div>
            <div className={s.s14}>
              <MetricCard label="Before (CLS)" value={p5.before} accent="#ef4444" />
              <MetricCard label="After (Phase 5)" value={p5.after} accent="#f59e0b" />
              <MetricCard label="Target" value={p5.target} accent="#10b981" />
              <MetricCard label="Reduction" value={`${p5.reduction}%`} sub="from Phase 5 polish" accent={C.b} />
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
              Sprints: {p5.sprintsCompleted.map((s) => `${s.id}. ${s.name} (${s.items} items)`).join(' · ')}
            </div>

            {/* Manifesto */}
            <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 8, letterSpacing: 0.5 }}>
                📜 SIMPLIFICATION MANIFESTO
              </div>
              <ol className={s.s15}>
                {SIMPLIFICATION_MANIFESTO.map((p, i) => (
                  <li key={i} style={{ fontSize: 12, color: C.t1, fontFamily: F, fontWeight: 500 }}>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        );
      })()}
      {/* ─── Phase 3.1.3: Rendering Performance ────────────── */}
      <RenderPerfSection MetricCard={MetricCard} />
    </div>
  );
}

// ─── Render Performance Section (extracted to avoid hook-in-callback) ──

function RenderPerfSection({ MetricCard }) {
  const [perfData, setPerfData] = useState(null);
  const [benchResult, setBenchResult] = useState(null);
  const [benchRunning, setBenchRunning] = useState(false);

  // Poll ChartPerfMonitor every 2s if it's running
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const monitor = window.__chartPerfMonitor;
        if (monitor && typeof monitor.getReport === 'function') {
          setPerfData(monitor.getReport());
        }
      } catch (e) { logger.ui.warn('Operation failed', e); }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const runBench = useCallback(async () => {
    setBenchRunning(true);
    await new Promise(r => setTimeout(r, 50));
    try {
      const noop = () => {};
      const result = StressTest.runFullBenchmark(noop, {
        tiers: [1000, 10000],
        durationMs: 500,
        viewportBars: 200,
      });
      setBenchResult(result);
    } catch (e) {
      setBenchResult({ error: e.message });
    }
    setBenchRunning(false);
  }, []);

  const stageColor = (ms) => ms > 8 ? '#ef4444' : ms > 4 ? '#f59e0b' : '#10b981';

  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
    }}>
      <div className={s.s16}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>⚡ Rendering Performance</div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginTop: 2 }}>Phase 3.1.3 — Live metrics + benchmark runner</div>
        </div>
        <button
          onClick={runBench}
          disabled={benchRunning}
          className="tf-btn"
          style={{
            fontSize: 11,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${C.bd}`,
            background: benchRunning ? C.bd : C.sf,
            color: benchRunning ? C.t3 : C.t1,
            cursor: benchRunning ? 'wait' : 'pointer',
            fontFamily: M,
          }}
        >
          {benchRunning ? '⏳ Running…' : '🏎️ Run Benchmark'}
        </button>
      </div>

      {/* Live Metrics */}
      {perfData ? (
        <div className={s.s17}>
          <MetricCard label="FPS" value={perfData.fps ?? '—'} accent={perfData.fps >= 55 ? C.g : C.r} />
          <MetricCard label="Frame Time" value={`${perfData.avgFrameMs?.toFixed(1) ?? '—'}ms`} accent={perfData.avgFrameMs <= 8 ? C.g : C.r} />
          <MetricCard label="Jank Frames" value={perfData.jankFrames ?? 0} accent={perfData.jankFrames > 5 ? '#ef4444' : C.g} />
          {perfData.gpuMs != null && (
            <MetricCard label="GPU Time" value={`${perfData.gpuMs.toFixed(1)}ms`} accent={perfData.gpuMs <= 4 ? C.g : '#f59e0b'} />
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 16, fontFamily: F }}>
          No live chart rendering detected. Open a chart to see real-time metrics.
        </div>
      )}

      {/* Stage Waterfall */}
      {perfData?.stageTimings && Object.keys(perfData.stageTimings).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 8 }}>Stage Waterfall</div>
          <div className={s.s18}>
            {Object.entries(perfData.stageTimings).map(([stage, ms]) => (
              <div key={stage} className={s.s19}>
                <div style={{ width: 80, fontSize: 10, fontFamily: M, color: C.t2, textAlign: 'right' }}>{stage}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.bd, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, ms * 10)}%`, height: '100%', borderRadius: 3, background: stageColor(ms), transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 40, fontSize: 10, fontFamily: M, color: stageColor(ms), textAlign: 'right' }}>{ms.toFixed(1)}ms</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memory Stats */}
      {perfData?.memory && (
        <div className={s.s20}>
          <MetricCard label="Buffer Memory" value={`${(perfData.memory.bufferBytes / 1024 / 1024).toFixed(1)}MB`} />
          <MetricCard label="Texture Memory" value={`${(perfData.memory.textureBytes / 1024 / 1024).toFixed(1)}MB`} />
        </div>
      )}

      {/* Diagnostics */}
      {perfData?.diagnostics?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: F, marginBottom: 6 }}>Diagnostics</div>
          {perfData.diagnostics.map((d, i) => (
            <div key={i} style={{
              fontSize: 11, fontFamily: F,
              color: d.severity === 'error' ? '#ef4444' : d.severity === 'warning' ? '#f59e0b' : C.t2,
              padding: '4px 0',
            }}>
              {d.severity === 'error' ? '🔴' : d.severity === 'warning' ? '🟡' : '🟢'} {d.message}
              {d.fix && <span style={{ color: C.t3 }}> — {d.fix}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Benchmark Results */}
      {benchResult && !benchResult.error && (
        <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 10 }}>
            Benchmark: {benchResult.report.verdict}
          </div>
          <div className={s.s21}>
            {benchResult.report.gates.map(g => (
              <div key={g.barCount} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: M }}>
                <span style={{ width: 80, color: C.t2 }}>{g.label}</span>
                <span style={{ width: 90, color: g.passed ? '#10b981' : '#ef4444' }}>{g.scrollFrameMs.toFixed(2)}ms</span>
                <span style={{ width: 70, color: C.t3 }}>gate: {g.maxFrameMs}ms</span>
                <span style={{ fontWeight: 700, color: g.passed ? '#10b981' : '#ef4444' }}>{g.verdict}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {benchResult?.error && (
        <div className={s.s22}>Benchmark error: {benchResult.error}</div>
      )}
    </div>
  );
}
