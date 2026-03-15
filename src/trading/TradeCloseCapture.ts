// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Close Capture Service
//
// Subscribes to paper trade close events and automatically:
//   1. Captures a hi-DPI screenshot of the chart canvas
//   2. Annotates it with trade metadata (entry, SL, TP, P&L)
//   3. Creates a journal entry with the screenshot embedded
//
// This service is initialized once at app boot and runs in the
// background — no React component needed.
// ═══════════════════════════════════════════════════════════════════

import { onTradeClose } from '../state/usePaperTradeStore';
import { dismissPositionAlerts } from '../state/useAlertStore';
import { captureChartScreenshot } from '../hooks/useAutoScreenshot.js';

// ─── Types ───────────────────────────────────────────────────────

interface ClosedTrade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  commission: number;
}

interface TradeCloseJournalEntry {
  id: string;
  timestamp: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  holdDuration: number;
  chartScreenshot: string | null; // base64 PNG
  tags: string[];
  notes: string;
  source: string;
}

// ─── Canvas Capture ──────────────────────────────────────────────

/**
 * Capture the chart canvas as a hi-DPI PNG with trade annotations.
 * Reuses the same strategy as ChartSnapshotModal.
 */
function captureChartWithAnnotations(
  trade: ClosedTrade,
  scale = 2,
): string | null {
  try {
    // Find the chart canvas in the DOM
    const canvas = document.querySelector(
      'canvas[data-chart-canvas], .tf-chart-canvas canvas, canvas',
    ) as HTMLCanvasElement | null;

    if (!canvas) return null;

    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, w, h);

    // ─── Trade Annotation Watermark ─────────────────────────
    const fs = Math.round(12 * scale);
    const pad = Math.round(10 * scale);
    const isWin = trade.pnl >= 0;

    // Bottom-right: trade result badge
    ctx.font = `bold ${fs}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    const resultText = `${trade.side.toUpperCase()} ${trade.symbol} | ${isWin ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(1)}%) | ${trade.exitReason.replace('_', ' ').toUpperCase()}`;

    // Badge background
    const metrics = ctx.measureText(resultText);
    const badgeW = metrics.width + pad * 2;
    const badgeH = fs + pad;
    const bx = w - pad;
    const by = h - pad;

    ctx.fillStyle = isWin ? 'rgba(38, 166, 154, 0.85)' : 'rgba(239, 83, 80, 0.85)';
    ctx.beginPath();
    const r = Math.round(6 * scale);
    ctx.roundRect(bx - badgeW, by - badgeH, badgeW, badgeH, r);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(resultText, bx - pad, by - pad / 3);

    // Top-left: charEdge watermark
    ctx.font = `600 ${Math.round(10 * scale)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    ctx.fillText(`charEdge · ${dateStr}`, pad, pad);

    return offscreen.toDataURL('image/png', 0.92);
  } catch {
    return null;
  }
}

// ─── Journal Entry Builder ───────────────────────────────────────

function buildJournalEntry(
  trade: ClosedTrade,
  screenshot: string | null,
): TradeCloseJournalEntry {
  const holdDuration = trade.exitTime - trade.entryTime;
  const holdMinutes = Math.round(holdDuration / 60000);
  const holdText =
    holdMinutes < 60
      ? `${holdMinutes}m`
      : `${Math.floor(holdMinutes / 60)}h ${holdMinutes % 60}m`;

  const isWin = trade.pnl >= 0;
  const emoji = isWin ? '✅' : '❌';
  const reasonLabel = trade.exitReason.replace(/_/g, ' ');

  return {
    id: `tc_${Date.now()}_${trade.id.slice(-6)}`,
    timestamp: Date.now(),
    symbol: trade.symbol,
    side: trade.side,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    pnl: trade.pnl,
    pnlPercent: trade.pnlPercent,
    exitReason: trade.exitReason,
    holdDuration,
    chartScreenshot: screenshot,
    tags: [
      trade.symbol,
      trade.side,
      trade.exitReason,
      isWin ? 'win' : 'loss',
      'auto-captured',
    ],
    notes: `${emoji} ${trade.side.toUpperCase()} ${trade.symbol} closed via ${reasonLabel} | Entry: $${trade.entryPrice.toFixed(2)} → Exit: $${trade.exitPrice.toFixed(2)} | P&L: ${isWin ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(1)}%) | Hold: ${holdText}`,
    source: 'trade-close-capture',
  };
}

// ─── Initialize ──────────────────────────────────────────────────

let _initialized = false;

/**
 * Initialize the trade close capture service.
 * Call once at app boot (e.g., in AppBoot.js).
 * Safe to call multiple times — only initializes once.
 */
export function initTradeCloseCapture(): () => void {
  if (_initialized) return () => {};
  _initialized = true;

  const unsubscribe = onTradeClose((closedTrade, exitReason) => {
    // Small delay to ensure chart has rendered the final state
    setTimeout(() => {
      try {
        const trade = closedTrade as ClosedTrade;
        // Use composite multi-layer capture (all 5 canvas layers)
        const compositeShot = captureChartScreenshot(trade.symbol, '');
        const screenshot = compositeShot?.data || captureChartWithAnnotations(trade);
        const entry = buildJournalEntry(trade, screenshot);

        // Dismiss any alerts linked to this position
        try { dismissPositionAlerts(trade.id); } catch { /* non-fatal */ }

        // Add to journal store
        import('../state/useJournalStore').then(({ useJournalStore }) => {
          const store = useJournalStore.getState() as any;
          if (store.addTrade) {
            // Compute R-Multiple if stop loss was set
            const risk = trade.exitReason !== 'manual' && trade.entryPrice && trade.exitPrice
              ? Math.abs(trade.exitPrice - trade.entryPrice)
              : null;
            const rMultiple = risk && risk > 0 ? Math.round((trade.pnl / (risk * trade.quantity)) * 100) / 100 : null;

            // Build screenshots array in { data, name } format for the journal row
            const screenshotArr: Array<{ data: string; name: string }> = [];
            if (compositeShot) {
              screenshotArr.push({ data: compositeShot.data, name: `${trade.symbol}_close_${Date.now()}.png` });
            } else if (screenshot) {
              screenshotArr.push({ data: screenshot, name: `${trade.symbol}_close_${Date.now()}.png` });
            }

            store.addTrade({
              id: entry.id,
              date: new Date(trade.entryTime).toISOString(),
              symbol: entry.symbol,
              side: entry.side,
              entry: trade.entryPrice,
              exit: trade.exitPrice,
              qty: trade.quantity,
              stopLoss: null,
              takeProfit: null,
              pnl: entry.pnl,
              fees: trade.commission || 0,
              rMultiple,
              notes: entry.notes,
              tags: entry.tags,
              chartScreenshot: entry.chartScreenshot,
              screenshots: screenshotArr.length > 0 ? screenshotArr : undefined,
              exitReason: entry.exitReason,
              holdDuration: entry.holdDuration,
              entryTime: trade.entryTime,
              exitTime: trade.exitTime,
              source: 'auto-capture',
            });
          }
        });

        // Show toast notification
        import('../app/components/ui/Toast.jsx').then(({ default: toast }) => {
          const isWin = closedTrade.pnl >= 0;
          toast[isWin ? 'success' : 'error'](
            `Trade closed: ${isWin ? '+' : ''}$${closedTrade.pnl.toFixed(2)} (${exitReason.replace('_', ' ')})`,
          );
        });
      } catch {
        // Capture failed — not critical, trade is already recorded
      }
    }, 500); // 500ms delay for chart to settle
  });

  return () => {
    unsubscribe();
    _initialized = false;
  };
}

export { captureChartWithAnnotations, buildJournalEntry };
export type { TradeCloseJournalEntry, ClosedTrade };
