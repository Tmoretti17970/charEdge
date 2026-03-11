// ═══════════════════════════════════════════════════════════════════
// charEdge — ExchangeTimezoneOverlay (P1-A #6)
// Renders colored session bands (Tokyo/London/NY) on the chart
// so multi-session traders can see market hours at a glance.
// ═══════════════════════════════════════════════════════════════════

// ─── Session Definitions ────────────────────────────────────────

export interface TradingSession {
  name: string;
  /** UTC hour for session open (0–23) */
  openHour: number;
  /** UTC hour for session close (0–23) */
  closeHour: number;
  /** Background band color (low alpha — must not obscure candles) */
  color: string;
  /** Label color */
  labelColor: string;
}

/** Default major trading sessions (UTC hours). */
export const SESSIONS: TradingSession[] = [
  { name: 'Tokyo',  openHour: 0,  closeHour: 9,  color: 'rgba(255,183,77,0.12)',  labelColor: 'rgba(255,183,77,0.6)' },
  { name: 'London', openHour: 8,  closeHour: 16, color: 'rgba(100,181,246,0.12)', labelColor: 'rgba(100,181,246,0.6)' },
  { name: 'New York', openHour: 13, closeHour: 21, color: 'rgba(129,199,132,0.12)', labelColor: 'rgba(129,199,132,0.6)' },
];

// ─── Rendering ──────────────────────────────────────────────────

interface DrawSessionsOpts {
  ctx: CanvasRenderingContext2D;
  /** Array of visible bars with .time (unix ms) */
  visBars: Array<{ time: number }>;
  /** Pixel ratio for crisp rendering */
  pr: number;
  /** Chart area height in bitmap pixels */
  chartHeight: number;
  /** Chart area width in bitmap pixels */
  chartWidth: number;
  /** Time transform from TimeAxis: converts index → pixel */
  indexToPixel: (idx: number) => number;
  /** Start index in the bars array */
  startIdx: number;
  /** Sessions to draw (defaults to SESSIONS) */
  sessions?: TradingSession[];
}

/**
 * Draw colored vertical bands for each active trading session.
 * Only renders for intraday timeframes (bars span < 1 day).
 */
export function drawSessionBands(opts: DrawSessionsOpts): void {
  const {
    ctx, visBars, pr, chartHeight, chartWidth,
    indexToPixel, startIdx, sessions = SESSIONS,
  } = opts;

  if (!visBars || visBars.length < 2) return;

  // Only render for intraday timeframes
  const firstBar = visBars[0];
  const lastBar = visBars[visBars.length - 1];
  if (!firstBar || !lastBar) return;
  const avgBarMs = (lastBar.time - firstBar.time) / visBars.length;
  if (avgBarMs >= 86400000) return; // Daily or higher — skip

  ctx.save();

  for (const session of sessions) {
    ctx.fillStyle = session.color;

    // Walk through visible bars, finding contiguous runs inside this session
    let bandStart = -1;

    for (let i = 0; i < visBars.length; i++) {
      const bar = visBars[i];
      if (!bar || !bar.time) continue;

      // Extract UTC hour directly from unix-ms timestamp (no Date allocation)
      const utcH = Math.floor((bar.time % 86400000) / 3600000);
      const inSession = session.openHour <= session.closeHour
        ? utcH >= session.openHour && utcH < session.closeHour
        : utcH >= session.openHour || utcH < session.closeHour; // wrap-around

      if (inSession && bandStart === -1) {
        bandStart = i;
      } else if (!inSession && bandStart !== -1) {
        // Draw the band
        const x1 = Math.round(indexToPixel(startIdx + bandStart) * pr);
        const x2 = Math.round(indexToPixel(startIdx + i) * pr);
        ctx.fillRect(x1, 0, x2 - x1, chartHeight);
        bandStart = -1;
      }
    }

    // Close any open band at the end
    if (bandStart !== -1) {
      const x1 = Math.round(indexToPixel(startIdx + bandStart) * pr);
      ctx.fillRect(x1, 0, chartWidth - x1, chartHeight);
    }
  }

  // ─── Session Labels (top of chart) ──────────────────────────
  const labelFs = Math.round(9 * pr);
  ctx.font = `${labelFs}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (const session of sessions) {
    // Find first bar in this session for label placement
    for (let i = 0; i < visBars.length; i++) {
      const bar = visBars[i];
      if (!bar || !bar.time) continue;
      const utcH = Math.floor((bar.time % 86400000) / 3600000);
      const inSession = session.openHour <= session.closeHour
        ? utcH >= session.openHour && utcH < session.closeHour
        : utcH >= session.openHour || utcH < session.closeHour;

      if (inSession) {
        // Check if this is the first bar of the session (previous bar was outside)
        if (i === 0 || !_isInSession(visBars[i - 1]?.time, session)) {
          const x = Math.round(indexToPixel(startIdx + i) * pr) + Math.round(4 * pr);
          if (x > 0 && x < chartWidth) {
            ctx.fillStyle = session.labelColor;
            ctx.fillText(session.name, x, Math.round(4 * pr));
          }
        }
      }
    }
  }

  ctx.restore();
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _isInSession(time: number | undefined, session: TradingSession): boolean {
  if (!time) return false;
  const utcH = Math.floor((time % 86400000) / 3600000);
  return session.openHour <= session.closeHour
    ? utcH >= session.openHour && utcH < session.closeHour
    : utcH >= session.openHour || utcH < session.closeHour;
}
