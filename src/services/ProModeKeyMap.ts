// ═══════════════════════════════════════════════════════════════════
// charEdge — One-Handed Pro Mode (G1.5)
//
// WASD pan, Q/E zoom, Tab timeframe cycle, Shift+1-9 quick tools.
// Activates when no input/textarea is focused. Toggle via settings.
// ═══════════════════════════════════════════════════════════════════

export interface ProModeConfig {
  enabled: boolean;
  panSpeed: number;     // px per key press
  zoomStep: number;     // zoom factor per key press
  timeframes: string[]; // ordered list for Tab cycling
}

const DEFAULT_CONFIG: ProModeConfig = {
  enabled: false,
  panSpeed: 40,
  zoomStep: 0.15,
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
};

type ProModeAction =
  | { type: 'pan'; direction: 'left' | 'right' | 'up' | 'down'; speed: number }
  | { type: 'zoom'; direction: 'in' | 'out'; step: number }
  | { type: 'timeframe'; direction: 'next' | 'prev' }
  | null;

const KEY_MAP: Record<string, ProModeAction> = {
  // WASD Pan
  w: { type: 'pan', direction: 'up', speed: 1 },
  a: { type: 'pan', direction: 'left', speed: 1 },
  s: { type: 'pan', direction: 'down', speed: 1 },
  d: { type: 'pan', direction: 'right', speed: 1 },

  // Arrow keys (alternative)
  ArrowUp: { type: 'pan', direction: 'up', speed: 1 },
  ArrowLeft: { type: 'pan', direction: 'left', speed: 1 },
  ArrowDown: { type: 'pan', direction: 'down', speed: 1 },
  ArrowRight: { type: 'pan', direction: 'right', speed: 1 },

  // Q/E Zoom
  q: { type: 'zoom', direction: 'out', step: 1 },
  e: { type: 'zoom', direction: 'in', step: 1 },

  // Tab = cycle timeframe
  Tab: { type: 'timeframe', direction: 'next' },
};

/**
 * Check if the currently focused element should block Pro Mode.
 */
function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (active as HTMLElement).contentEditable === 'true'
  );
}

export class ProModeKeyMap {
  private config: ProModeConfig;
  private onAction: (action: NonNullable<ProModeAction>) => void;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;
  private activeKeys = new Set<string>();

  constructor(
    onAction: (action: NonNullable<ProModeAction>) => void,
    config: Partial<ProModeConfig> = {},
  ) {
    this.onAction = onAction;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start listening for keyboard input.
   */
  enable(): void {
    if (this.boundHandler) return;

    this.boundHandler = (e: KeyboardEvent) => {
      if (!this.config.enabled) return;
      if (isInputFocused()) return;

      const action = KEY_MAP[e.key];
      if (!action) return;

      // Prevent default for Tab
      if (e.key === 'Tab') e.preventDefault();

      // Prevent key repeat spam
      if (this.activeKeys.has(e.key)) return;
      this.activeKeys.add(e.key);

      // Scale action values by config
      if (action.type === 'pan') {
        this.onAction({ ...action, speed: this.config.panSpeed });
      } else if (action.type === 'zoom') {
        this.onAction({ ...action, step: this.config.zoomStep });
      } else {
        this.onAction(action);
      }
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      this.activeKeys.delete(e.key);
    };

    document.addEventListener('keydown', this.boundHandler);
    document.addEventListener('keyup', keyUpHandler);

    // Store for cleanup
    (this as any)._keyUpHandler = keyUpHandler;
  }

  /**
   * Stop listening.
   */
  disable(): void {
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }
    if ((this as any)._keyUpHandler) {
      document.removeEventListener('keyup', (this as any)._keyUpHandler);
      (this as any)._keyUpHandler = null;
    }
    this.activeKeys.clear();
  }

  /**
   * Toggle enabled state.
   */
  toggle(enabled?: boolean): void {
    this.config.enabled = enabled ?? !this.config.enabled;
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<ProModeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default ProModeKeyMap;
