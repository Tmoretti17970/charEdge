// ═══════════════════════════════════════════════════════════════════
// charEdge — Touch Target Audit (Phase 3, Task 3.1.1)
//
// Runtime utility to scan interactive elements and report those
// smaller than the WCAG 2.2 SC 2.5.8 minimum (44×44px).
//
// Usage (dev only):
//   import { auditTouchTargets, overlayViolations } from './touchTargetAudit.ts';
//   const violations = auditTouchTargets();
//   overlayViolations(violations); // red outlines on undersized elements
// ═══════════════════════════════════════════════════════════════════

/** Minimum touch target size per WCAG 2.2 SC 2.5.8 */
const MIN_SIZE = 44;

/** Selectors for interactive elements */
const INTERACTIVE_SELECTORS = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface TouchTargetViolation {
    element: HTMLElement;
    selector: string;
    width: number;
    height: number;
    minDimension: number;
    text: string;
    fix: string;
}

/**
 * Build a human-readable CSS selector for an element.
 */
function buildSelector(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
    return `${tag}${id}${classes}${role}`.slice(0, 80);
}

/**
 * Scan the DOM for interactive elements smaller than 44×44px.
 * @param root — Element to scan within (default: document.body)
 * @returns Array of violations
 */
export function auditTouchTargets(root: HTMLElement = document.body): TouchTargetViolation[] {
    const elements = root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTORS);
    const violations: TouchTargetViolation[] = [];

    for (const el of elements) {
        // Skip hidden elements
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
        }

        const rect = el.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        const minDim = Math.min(width, height);

        if (minDim < MIN_SIZE && (width > 0 || height > 0)) {
            const text = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40);
            const deltaW = Math.max(0, MIN_SIZE - width);
            const deltaH = Math.max(0, MIN_SIZE - height);

            violations.push({
                element: el,
                selector: buildSelector(el),
                width,
                height,
                minDimension: minDim,
                text,
                fix: `Add min-width: ${MIN_SIZE}px; min-height: ${MIN_SIZE}px;` +
                    (deltaW > 0 ? ` (+${deltaW}px width)` : '') +
                    (deltaH > 0 ? ` (+${deltaH}px height)` : ''),
            });
        }
    }

    return violations;
}

/**
 * Dev overlay — draws red outlines around undersized touch targets.
 * Returns a cleanup function.
 */
export function overlayViolations(violations: TouchTargetViolation[]): () => void {
    const ATTR = 'data-touch-violation';

    for (const v of violations) {
        v.element.setAttribute(ATTR, 'true');
        v.element.style.outline = '2px solid #EF5350';
        v.element.style.outlineOffset = '2px';
        v.element.title = `Touch target too small: ${v.width}×${v.height}px (min ${MIN_SIZE}×${MIN_SIZE}px)`;
    }

    return () => {
        for (const v of violations) {
            v.element.removeAttribute(ATTR);
            v.element.style.outline = '';
            v.element.style.outlineOffset = '';
            v.element.title = '';
        }
    };
}

/**
 * Console report of violations (dev tool).
 */
export function reportTouchTargets(root?: HTMLElement): void {
    const violations = auditTouchTargets(root);

    if (violations.length === 0) {
        // eslint-disable-next-line no-console
        console.info('✅ All touch targets meet 44×44px minimum');
        return;
    }

    // eslint-disable-next-line no-console
    console.warn(`⚠️ ${violations.length} touch target violations:`);
    // eslint-disable-next-line no-console
    console.table(violations.map(v => ({
        selector: v.selector,
        size: `${v.width}×${v.height}`,
        text: v.text,
        fix: v.fix,
    })));
}
