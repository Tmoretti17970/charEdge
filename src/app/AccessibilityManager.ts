// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility Manager (Sprint 98)
//
// WCAG 2.1 AA compliance utilities: screen reader announcements,
// focus traps, keyboard navigation helpers, skip-to-content,
// and reduced motion detection.
//
// Usage:
//   import { accessibilityManager } from './AccessibilityManager';
//   accessibilityManager.init();
//   accessibilityManager.announce('Trade saved successfully');
// ═══════════════════════════════════════════════════════════════════

// ─── Manager ────────────────────────────────────────────────────

class AccessibilityManager {
  private _liveRegion: HTMLElement | null = null;
  private _skipLink: HTMLElement | null = null;
  private _initialized = false;
  private _focusTrapStack: FocusTrap[] = [];

  /**
   * Initialize accessibility features.
   */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;

    this._createLiveRegion();
    this._createSkipLink();
    this._installKeyboardDetection();
  }

  // ─── Announcements ──────────────────────────────────────────

  /**
   * Announce a message to screen readers.
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this._liveRegion) this._createLiveRegion();

    const region = this._liveRegion!;
    region.setAttribute('aria-live', priority);
    region.textContent = '';

    // Brief delay to ensure the change is detected
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }

  // ─── Focus Trap ─────────────────────────────────────────────

  /**
   * Create a focus trap within an element (for modals/drawers).
   */
  trapFocus(container: HTMLElement): FocusTrap {
    const trap = new FocusTrap(container);
    this._focusTrapStack.push(trap);
    trap.activate();
    return trap;
  }

  /**
   * Release the most recent focus trap.
   */
  releaseFocus(): void {
    const trap = this._focusTrapStack.pop();
    if (trap) trap.deactivate();
  }

  // ─── Roving Tabindex ────────────────────────────────────────

  /**
   * Install roving tabindex on a container with focusable children.
   */
  rovingTabindex(container: HTMLElement, selector = '[role="tab"], [role="option"], button'): () => void {
    const items = () => Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    let currentIndex = 0;

    const update = () => {
      const els = items();
      els.forEach((el, i) => {
        el.tabIndex = i === currentIndex ? 0 : -1;
      });
    };

    const handler = (e: KeyboardEvent) => {
      const els = items();
      if (!els.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % els.length;
        update();
        els[currentIndex].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + els.length) % els.length;
        update();
        els[currentIndex].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentIndex = 0;
        update();
        els[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        currentIndex = els.length - 1;
        update();
        els[currentIndex].focus();
      }
    };

    container.addEventListener('keydown', handler);
    update();

    return () => container.removeEventListener('keydown', handler);
  }

  // ─── Reduced Motion ─────────────────────────────────────────

  /**
   * Check if user prefers reduced motion.
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Subscribe to reduced motion preference changes.
   */
  onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }

  // ─── Internal ────────────────────────────────────────────────

  private _createLiveRegion(): void {
    if (this._liveRegion) return;

    const region = document.createElement('div');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('role', 'status');
    region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.appendChild(region);
    this._liveRegion = region;
  }

  private _createSkipLink(): void {
    const mainContent = document.querySelector('main, [role="main"], #app, #root');
    if (!mainContent) return;

    if (!mainContent.id) mainContent.id = 'main-content';

    const link = document.createElement('a');
    link.href = `#${mainContent.id}`;
    link.textContent = 'Skip to main content';
    link.className = 'sr-skip-link';
    link.style.cssText = `
      position: fixed; top: -100px; left: 16px; z-index: 99999;
      padding: 8px 16px; background: var(--accent, #6366f1);
      color: white; border-radius: 4px; font-size: 14px;
      text-decoration: none; transition: top 0.15s;
    `;

    link.addEventListener('focus', () => { link.style.top = '16px'; });
    link.addEventListener('blur', () => { link.style.top = '-100px'; });

    document.body.prepend(link);
    this._skipLink = link;
  }

  private _installKeyboardDetection(): void {
    // Add .keyboard-user class when Tab is pressed
    const onTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-user');
      }
    };
    const onMouse = () => {
      document.body.classList.remove('keyboard-user');
    };

    document.addEventListener('keydown', onTab);
    document.addEventListener('mousedown', onMouse);
  }
}

// ─── Focus Trap Class ───────────────────────────────────────────

class FocusTrap {
  private _container: HTMLElement;
  private _previousFocus: Element | null = null;
  private _handler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this._container = container;
  }

  activate(): void {
    this._previousFocus = document.activeElement;

    const focusables = this._getFocusableElements();
    if (focusables.length > 0) focusables[0].focus();

    this._handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusables = this._getFocusableElements();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', this._handler);
  }

  deactivate(): void {
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
      this._handler = null;
    }
    if (this._previousFocus instanceof HTMLElement) {
      this._previousFocus.focus();
    }
  }

  private _getFocusableElements(): HTMLElement[] {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this._container.querySelectorAll(selector)) as HTMLElement[];
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const accessibilityManager = new AccessibilityManager();
export default accessibilityManager;
