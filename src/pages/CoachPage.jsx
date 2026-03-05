// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Insights Page (H2.3)
//
// Dedicated insights page with 3 tabs:
//   Report | Pre-Trade | Journal Summary
//
// Hero section shows overall grade, tabs switch content.
// (Rebranded from "AI Coach" / "Char" in Wave 0)
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { useJournalStore } from '../state/useJournalStore.js';
import { useAICoachStore } from '../state/useAICoachStore.js';
import { useUserStore } from '../state/useUserStore.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import { computeFast } from '../app/features/analytics/analyticsFast.js';
import WeeklyReportCard from '../app/components/coach/WeeklyReportCard.jsx';
import PreTradePanel from '../app/components/coach/PreTradePanel.jsx';
import WeeklySummaryCard from '../app/components/coach/WeeklySummaryCard.jsx';

const TABS = [
  { id: 'report', label: 'Weekly Report', icon: '📊' },
  { id: 'pretrade', label: 'Pre-Trade', icon: '🔍' },
  { id: 'summary', label: 'Journal Summary', icon: '📋' },
];

const GRADE_COLORS = {
  A: '#00E676', B: '#66BB6A', C: '#FFCA28', D: '#FF7043', F: '#EF5350',
};

export default function CoachPage() {
  const trades = useJournalStore(s => s.trades);
  const notes = useJournalStore(s => s.notes);
  const settings = useUserStore.getState();
  const { isMobile } = useBreakpoints();

  const coachTab = useAICoachStore(s => s.coachTab);
  const setCoachTab = useAICoachStore(s => s.setCoachTab);
  const weeklyReports = useAICoachStore(s => s.weeklyReports);
  const weeklySummaries = useAICoachStore(s => s.weeklySummaries);
  const generateReport = useAICoachStore(s => s.generateReport);
  const generateSummary = useAICoachStore(s => s.generateSummary);

  const analytics = useMemo(() => {
    if (!trades || trades.length < 3) return null;
    try { return computeFast(trades, settings); }
    catch (_) { return null; }
  }, [trades, settings]);

  const latestReport = weeklyReports[0] || null;
  const latestSummary = weeklySummaries[0] || null;

  const handleGenerateReport = useCallback(() => {
    generateReport(trades, analytics, settings);
  }, [trades, analytics, settings, generateReport]);

  const handleGenerateSummary = useCallback(() => {
    generateSummary(trades, notes, analytics);
  }, [trades, notes, analytics, generateSummary]);

  const gradeColor = latestReport ? GRADE_COLORS[latestReport.grade] || C.t3 : C.t3;

  return (
    <div data-container="coach" className="tf-container" style={{
      padding: isMobile ? '16px 12px 80px' : '24px 32px',
      maxWidth: 720,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Hero */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: latestReport ? `${gradeColor}12` : `${C.b}12`,
          border: `2px solid ${latestReport ? `${gradeColor}30` : `${C.b}30`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: latestReport ? 28 : 24,
          fontWeight: 800, fontFamily: F,
          color: latestReport ? gradeColor : C.b,
        }}>
          {latestReport ? latestReport.grade : '🧠'}
        </div>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: F,
            margin: 0,
          }}>
            Smart Insights
          </h1>
          <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 2 }}>
            {latestReport
              ? `Score: ${latestReport.score}/100 • ${latestReport.comparison.trend === 'improving' ? '📈 Improving' : latestReport.comparison.trend === 'declining' ? '📉 Declining' : '→ Flat'}`
              : 'Your personalized trading insights'}
          </div>
        </div>
      </div>

      {/* Educational Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 14px',
        marginBottom: 16,
        borderRadius: 10,
        background: `${C.y}08`,
        border: `1px solid ${C.y}20`,
      }}>
        <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <span style={{ fontSize: 11, fontFamily: F, color: C.t3, lineHeight: 1.5 }}>
          <strong style={{ color: C.t2 }}>For educational purposes only.</strong> charEdge does not provide financial advice,
          trading recommendations, or investment guidance. Always do your own research.
        </span>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        background: `${C.t3}08`,
        borderRadius: 12,
        padding: 3,
      }}>
        {TABS.map(tab => {
          const active = coachTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCoachTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 2px',
                borderRadius: 10,
                border: 'none',
                background: active ? C.sf : 'transparent',
                boxShadow: active ? `0 1px 4px ${C.bg}30` : 'none',
                color: active ? C.t1 : C.t3,
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                fontFamily: F,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12 }}>{tab.icon}</span>
              {!isMobile && tab.label}
              {isMobile && tab.label.split(' ').pop()}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {coachTab === 'report' && (
        <div>
          <button
            onClick={handleGenerateReport}
            disabled={!trades || trades.length < 3}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: trades?.length >= 3 ? `linear-gradient(135deg, ${C.b}, ${C.y})` : C.bd,
              color: trades?.length >= 3 ? '#fff' : C.t3,
              fontSize: 14, fontWeight: 700, fontFamily: F,
              cursor: trades?.length >= 3 ? 'pointer' : 'default',
              marginBottom: 20,
              transition: 'all 0.2s',
              boxShadow: trades?.length >= 3 ? `0 4px 16px ${C.b}30` : 'none',
            }}
          >
            ✨ Generate Weekly Report
          </button>

          {latestReport ? (
            <WeeklyReportCard report={latestReport} />
          ) : (
            <EmptyState icon="📊" title="No reports yet" body="Generate your first coaching report to get personalized insights." />
          )}

          {/* Historical reports */}
          {weeklyReports.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Previous Reports
              </div>
              {weeklyReports.slice(1).map((r, i) => (
                <WeeklyReportCard key={i} report={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {coachTab === 'pretrade' && <PreTradePanel />}

      {coachTab === 'summary' && (
        <div>
          <button
            onClick={handleGenerateSummary}
            disabled={!trades || trades.length < 1}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: trades?.length >= 1 ? `linear-gradient(135deg, ${C.b}, ${C.y})` : C.bd,
              color: trades?.length >= 1 ? '#fff' : C.t3,
              fontSize: 14, fontWeight: 700, fontFamily: F,
              cursor: trades?.length >= 1 ? 'pointer' : 'default',
              marginBottom: 20,
              transition: 'all 0.2s',
              boxShadow: trades?.length >= 1 ? `0 4px 16px ${C.b}30` : 'none',
            }}
          >
            📋 Generate Weekly Summary
          </button>

          {latestSummary ? (
            <WeeklySummaryCard summary={latestSummary} />
          ) : (
            <EmptyState icon="📋" title="No summaries yet" body="Generate your first weekly summary to see your trading narrative." />
          )}

          {/* Historical summaries */}
          {weeklySummaries.length > 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, fontFamily: M, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Previous Summaries
              </div>
              {weeklySummaries.slice(1).map((s, i) => (
                <WeeklySummaryCard key={i} summary={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 14,
      padding: 32,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.t2, fontFamily: F }}>{title}</div>
      <div style={{ fontSize: 12, color: C.t3, fontFamily: M, marginTop: 4 }}>{body}</div>
    </div>
  );
}
