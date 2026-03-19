// Shared helper components for Morning Briefing
import { C } from '@/constants.js';
import { alpha } from '@/shared/colorUtils';

export function SignalDot({ signal }) {
  const colors = { bullish: C.g, bearish: C.r, neutral: C.y };
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: colors[signal] || C.t3,
        boxShadow: `0 0 4px ${alpha(colors[signal] || C.t3, 0.4)}`,
        flexShrink: 0,
      }}
    />
  );
}

export function NewsSentimentDot({ sentiment }) {
  const colors = { bullish: C.g, bearish: C.r, neutral: C.y };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: colors[sentiment] || C.t3,
        marginRight: 4,
        verticalAlign: 'middle',
      }}
    />
  );
}
