// Patterns Tab for InsightsPanel
import { useMemo } from 'react';
import { detectPatterns, gradePatterns } from '../../../../charting_library/studies/PatternDetector.js';
import { C, M } from '@/constants.js';

function getSevColor(severity) {
  return { danger: C.r, warning: C.y, positive: C.g, info: C.b }[severity];
}
const SEV_EMOJI = { danger: '🔴', warning: '🟡', positive: '🟢', info: '🔵' };

export default function PatternsTab({ trades }) {
  const insights = useMemo(() => detectPatterns(trades), [trades]);
  const grade = useMemo(() => gradePatterns(insights), [insights]);

  if (insights.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
        <div style={{ fontSize: 13 }}>Not enough data for pattern detection</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Add more trades to unlock behavioral insights</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      {/* Grade badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: C.sf,
          borderRadius: 8,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 28 }}>{grade.emoji}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, fontFamily: M }}>Grade {grade.grade}</div>
          <div style={{ fontSize: 11, color: C.t3 }}>{grade.summary}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: C.t3, fontFamily: M }}>
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Insight cards */}
      {insights.map((ins) => (
        <div
          key={ins.id}
          style={{
            padding: '8px 10px',
            background: C.sf,
            borderRadius: 6,
            marginBottom: 4,
            borderLeft: `3px solid ${getSevColor(ins.severity) || C.b}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12 }}>{SEV_EMOJI[ins.severity]}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, flex: 1 }}>{ins.title}</span>
            <span
              style={{
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 3,
                background: (getSevColor(ins.severity) || C.b) + '15',
                color: getSevColor(ins.severity) || C.b,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {ins.category}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>{ins.body}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: C.t3, fontFamily: M }}>
            <span>{ins.sampleSize} trades</span>
            <span>{Math.round(ins.confidence * 100)}% confidence</span>
          </div>
        </div>
      ))}
    </div>
  );
}
