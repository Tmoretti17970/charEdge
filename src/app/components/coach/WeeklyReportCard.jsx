// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Report Card (H2.3)
//
// Renders a single coaching report with grade badge, collapsible
// sections, recommendation pills, and week-over-week comparison.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C } from '../../../constants.js';
import st from './WeeklyReportCard.module.css';

const GRADE_COLORS = {
  A: '#00E676', B: '#66BB6A', C: '#FFCA28', D: '#FF7043', F: '#EF5350',
};

export default function WeeklyReportCard({ report }) {
  if (!report) return null;

  const gradeColor = GRADE_COLORS[report.grade] || C.t3;

  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Grade Badge */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${gradeColor}15`,
            border: `2px solid ${gradeColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, fontFamily: 'var(--tf-font)', color: gradeColor,
          }}>
            {report.grade}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
              Weekly Report
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-mono)' }}>
              Week of {report.weekOf} • Score: {report.score}/100
            </div>
          </div>
        </div>

        {/* Trend badge */}
        <div style={{
          padding: '4px 10px',
          borderRadius: 100,
          background: report.comparison.trend === 'improving' ? '#00E67615' : report.comparison.trend === 'declining' ? '#EF535015' : `${C.t3}15`,
          border: `1px solid ${report.comparison.trend === 'improving' ? '#00E67640' : report.comparison.trend === 'declining' ? '#EF535040' : `${C.t3}30`}`,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-mono)',
            color: report.comparison.trend === 'improving' ? '#00E676' : report.comparison.trend === 'declining' ? '#EF5350' : C.t3,
          }}>
            {report.comparison.trend === 'improving' ? '📈 Improving' : report.comparison.trend === 'declining' ? '📉 Declining' : '→ Flat'}
          </span>
        </div>
      </div>

      {/* Top Insight */}
      <div style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: `${C.b}08`,
        border: `1px solid ${C.b}20`,
        marginBottom: 16,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>💡</span>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--tf-mono)', color: C.b, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Focus Area: {report.focusArea}
          </div>
          <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-mono)', lineHeight: 1.5 }}>
            {report.topInsight}
          </div>
        </div>
      </div>

      {/* Sections */}
      {report.sections.map((section, i) => (
        <ReportSection key={i} section={section} />
      ))}

      {/* Week Comparison */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 12,
        padding: '12px 14px', borderRadius: 10,
        background: `${C.t3}08`,
      }}>
        <ComparisonStat label="Last Week" value={fmtUSD(report.comparison.prevWeekPnl)} />
        <ComparisonStat label="This Week" value={fmtUSD(report.comparison.thisWeekPnl)} />
        <ComparisonStat label="Change"
          value={fmtUSD(report.comparison.thisWeekPnl - report.comparison.prevWeekPnl)}
          color={report.comparison.thisWeekPnl > report.comparison.prevWeekPnl ? '#00E676' : '#EF5350'}
        />
      </div>
    </div>
  );
}

function ReportSection({ section }) {
  const [open, setOpen] = useState(false);
  const gradeColor = GRADE_COLORS[section.grade] || C.t3;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${C.bd}`,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 16 }}>{section.icon}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
          {section.title}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, fontFamily: 'var(--tf-mono)',
          color: gradeColor,
          padding: '2px 8px', borderRadius: 100,
          background: `${gradeColor}15`,
        }}>
          {section.grade}
        </span>
        <span style={{ fontSize: 10, color: C.t3, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-mono)', marginBottom: 6 }}>
            {section.summary}
          </div>
          <div style={{ fontSize: 12, color: C.t2, fontFamily: 'var(--tf-mono)', lineHeight: 1.6, marginBottom: 10 }}>
            {section.details}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.recommendations.map((rec, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                background: `${C.y}08`,
                border: `1px solid ${C.y}20`,
              }}>
                <span style={{ fontSize: 10, marginTop: 1 }}>→</span>
                <span style={{ fontSize: 11, color: C.t2, fontFamily: 'var(--tf-mono)', lineHeight: 1.4 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonStat({ label, value, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: 'var(--tf-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || C.t1, fontFamily: 'var(--tf-font)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function fmtUSD(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
