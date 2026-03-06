// ═══════════════════════════════════════════════════════════════════
// charEdge — Favicon Price Badge (TypeScript)
//
// Task 3.6.6: Update browser tab favicon with price direction + %
// change to give traders peripheral awareness without switching tabs.
//
// Usage:
//   import { updateFaviconBadge } from './faviconBadge';
//   updateFaviconBadge(2.34);   // up arrow, green
//   updateFaviconBadge(-1.12);  // down arrow, red
//   updateFaviconBadge(0);      // dash, neutral
//   resetFavicon();             // restore original
// ═══════════════════════════════════════════════════════════════════

const CANVAS_SIZE = 32;
const FONT_SIZE = 11;
const ARROW_SIZE = 9;

let _originalHref: string | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _link: HTMLLinkElement | null = null;

function getLink(): HTMLLinkElement {
    if (_link) return _link;
    _link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!_link) {
        _link = document.createElement('link');
        _link.rel = 'icon';
        _link.type = 'image/png';
        document.head.appendChild(_link);
    }
    if (!_originalHref) {
        _originalHref = _link.href;
    }
    return _link;
}

function getCanvas(): HTMLCanvasElement {
    if (_canvas) return _canvas;
    _canvas = document.createElement('canvas');
    _canvas.width = CANVAS_SIZE;
    _canvas.height = CANVAS_SIZE;
    return _canvas;
}

/**
 * Update the favicon with a price change badge.
 * @param pctChange - Percentage change (e.g. 2.34, -1.12)
 */
export function updateFaviconBadge(pctChange: number): void {
    if (typeof document === 'undefined') return;

    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = CANVAS_SIZE;
    ctx.clearRect(0, 0, size, size);

    // ── Background circle ────────────────────────────────────
    const isUp = pctChange > 0.01;
    const isDown = pctChange < -0.01;

    const bgColor = isUp ? '#10b981' : isDown ? '#ef4444' : '#6b7280';
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // ── Arrow ────────────────────────────────────────────────
    const cx = size / 2;
    const arrowY = 7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();

    if (isUp) {
        // Up triangle
        ctx.moveTo(cx, arrowY - 1);
        ctx.lineTo(cx + ARROW_SIZE / 2, arrowY + ARROW_SIZE - 2);
        ctx.lineTo(cx - ARROW_SIZE / 2, arrowY + ARROW_SIZE - 2);
    } else if (isDown) {
        // Down triangle
        ctx.moveTo(cx, arrowY + ARROW_SIZE - 1);
        ctx.lineTo(cx + ARROW_SIZE / 2, arrowY);
        ctx.lineTo(cx - ARROW_SIZE / 2, arrowY);
    } else {
        // Dash
        ctx.rect(cx - 4, arrowY + 3, 8, 2);
    }
    ctx.fill();

    // ── Percentage text ──────────────────────────────────────
    const label = Math.abs(pctChange) >= 10
        ? `${Math.round(Math.abs(pctChange))}`
        : Math.abs(pctChange).toFixed(1);

    ctx.font = `bold ${FONT_SIZE}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, size - 2);

    // ── Apply ────────────────────────────────────────────────
    const link = getLink();
    link.href = canvas.toDataURL('image/png');
}

/**
 * Restore the original favicon.
 */
export function resetFavicon(): void {
    if (typeof document === 'undefined') return;
    const link = getLink();
    if (_originalHref) {
        link.href = _originalHref;
    }
}
