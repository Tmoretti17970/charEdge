// Section 5: Edge Insights for Morning Briefing
import { C } from '@/constants.js';
import { alpha } from '@/shared/colorUtils';

export default function EdgeInsights({ insights }) {
  const typeColors = { positive: C.g, caution: C.y, info: C.b };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {insights.map((insight, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            background: alpha(typeColors[insight.type] || C.b, 0.06),
            border: `1px solid ${alpha(typeColors[insight.type] || C.b, 0.12)}`,
            borderRadius: 10,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{insight.icon}</span>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: C.t2,
              fontFamily: 'var(--tf-font)',
              lineHeight: 1.6,
            }}
          >
            {insight.text}
          </p>
        </div>
      ))}
    </div>
  );
}
