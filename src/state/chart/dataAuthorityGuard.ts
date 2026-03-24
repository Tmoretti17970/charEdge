const ALLOWED_STACK_PATTERNS = [
  'ChartEngineWidget.jsx',
  'charting_library/datafeed/DatafeedService',
  'TickChannel',
];

const warnedCallsites = new Set<string>();

function getStackLine(stack: string | undefined): string {
  if (!stack) return 'unknown';
  const lines = stack.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[2] || lines[1] || lines[0] || 'unknown';
}

export function warnIfNonCanonicalChartDataWrite(source: string | null | undefined): void {
  // Keep production clean while enforcing migration in dev/test.
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) return;

  const stack = new Error().stack;
  const allowed = ALLOWED_STACK_PATTERNS.some((pattern) => stack?.includes(pattern));
  if (allowed) return;

  const callsite = getStackLine(stack);
  const key = `${source || 'unknown'}::${callsite}`;
  if (warnedCallsites.has(key)) return;
  warnedCallsites.add(key);

  // Phase A guardrail: detect and inventory non-canonical writes.
  // eslint-disable-next-line no-console
  console.warn(
    `[ADR-001] Non-canonical chart data write detected via setData(source="${source || 'unknown'}").`,
    {
      callsite,
      note: 'Route chart bars through DatafeedService/ChartEngineWidget canonical path.',
    }
  );
}
