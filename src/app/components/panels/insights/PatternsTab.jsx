// Patterns Tab for InsightsPanel
import { useMemo } from 'react';
import { detectPatterns, gradePatterns } from '../../../../charting_library/studies/PatternDetector.js';
import { C } from '@/constants.js';
import st from './PatternsTab.module.css';

function getSevColor(severity) {
  return { danger: C.r, warning: C.y, positive: C.g, info: C.b }[severity];
}
const SEV_EMOJI = { danger: '🔴', warning: '🟡', positive: '🟢', info: '🔵' };

export default function PatternsTab({ trades }) {
  const insights = useMemo(() => detectPatterns(trades), [trades]);
  const grade = useMemo(() => gradePatterns(insights), [insights]);

  if (insights.length === 0) {
    return (
      <div className={st.empty}>
        <div className={st.emptyIcon}>🔍</div>
        <div className={st.emptyTitle}>Not enough data for pattern detection</div>
        <div className={st.emptyHint}>Add more trades to unlock behavioral insights</div>
      </div>
    );
  }

  return (
    <div className={st.root}>
      <div className={st.gradeCard}>
        <span className={st.gradeEmoji}>{grade.emoji}</span>
        <div>
          <div className={st.gradeTitle}>Grade {grade.grade}</div>
          <div className={st.gradeSummary}>{grade.summary}</div>
        </div>
        <div className={st.gradeCount}>
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </div>
      </div>

      {insights.map((ins) => (
        <div
          key={ins.id}
          className={st.insightCard}
          style={{ '--sev-color': getSevColor(ins.severity) || C.b }}
        >
          <div className={st.insightHeader}>
            <span className={st.insightEmoji}>{SEV_EMOJI[ins.severity]}</span>
            <span className={st.insightTitle}>{ins.title}</span>
            <span className={st.catBadge}>{ins.category}</span>
          </div>
          <div className={st.insightBody}>{ins.body}</div>
          <div className={st.insightMeta}>
            <span>{ins.sampleSize} trades</span>
            <span>{Math.round(ins.confidence * 100)}% confidence</span>
          </div>
        </div>
      ))}
    </div>
  );
}
