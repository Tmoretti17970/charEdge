// ═══════════════════════════════════════════════════════════════════
// charEdge — Capability Registry + Action Dispatcher (Sprint 16)
//
// Registry of actions the AI can trigger from chat.
// Dispatcher executes actions and parses [ACTION:] blocks from LLM.
//
// Usage:
//   import { capabilityRegistry, actionDispatcher } from './ActionDispatcher';
//   capabilityRegistry.register('set_alert', 'Set price alert', handler);
//   actionDispatcher.dispatch('set_alert', { price: 65000 });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface Capability {
  name: string;
  description: string;
  params: string[];         // Expected parameter names
  handler: (params: Record<string, unknown>) => Promise<string> | string;
}

export interface ActionBlock {
  action: string;
  params: Record<string, unknown>;
}

export interface ActionResult {
  action: string;
  success: boolean;
  output: string;
}

// ─── Capability Registry ────────────────────────────────────────

export class CapabilityRegistry {
  private _capabilities = new Map<string, Capability>();

  /**
   * Register a capability.
   */
  register(name: string, description: string, params: string[], handler: Capability['handler']): void {
    this._capabilities.set(name, { name, description, params, handler });
  }

  /**
   * Get all registered capabilities.
   */
  getCapabilities(): Capability[] {
    return [...this._capabilities.values()];
  }

  /**
   * Get capability by name.
   */
  get(name: string): Capability | undefined {
    return this._capabilities.get(name);
  }

  /**
   * Check if an action can be executed.
   */
  canExecute(name: string): boolean {
    return this._capabilities.has(name);
  }

  /**
   * Format capabilities for LLM context injection.
   */
  getCapabilitiesForPrompt(): string {
    if (this._capabilities.size === 0) return '';

    const lines = [...this._capabilities.values()].map(c =>
      `- ${c.name}(${c.params.join(', ')}): ${c.description}`
    );
    return `--- Available Actions ---\nYou can trigger actions by including [ACTION: name | param=value] in your response.\n${lines.join('\n')}`;
  }
}

// ─── Action Dispatcher ──────────────────────────────────────────

export class ActionDispatcher {
  constructor(private _registry: CapabilityRegistry) {}

  /**
   * Execute a registered action.
   */
  async dispatch(actionName: string, params: Record<string, unknown> = {}): Promise<ActionResult> {
    const capability = this._registry.get(actionName);
    if (!capability) {
      return { action: actionName, success: false, output: `Unknown action: ${actionName}` };
    }

    try {
      const output = await capability.handler(params);
      return { action: actionName, success: true, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { action: actionName, success: false, output: `Action failed: ${msg}` };
    }
  }

  /**
   * Parse [ACTION:] blocks from LLM response text.
   */
  parseActionsFromResponse(text: string): ActionBlock[] {
    const actions: ActionBlock[] = [];
    const regex = /\[ACTION:\s*(\w+)\s*(?:\|\s*(.+?))?\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const action = match[1];
      const paramsStr = match[2] || '';
      const params: Record<string, unknown> = {};

      // Parse key=value pairs
      for (const pair of paramsStr.split(',')) {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          params[key.trim()] = isNaN(Number(value)) ? value : Number(value);
        }
      }

      actions.push({ action, params });
    }

    return actions;
  }

  /**
   * Execute all actions found in a response.
   */
  async executeResponseActions(text: string): Promise<ActionResult[]> {
    const blocks = this.parseActionsFromResponse(text);
    const results: ActionResult[] = [];

    for (const block of blocks) {
      const result = await this.dispatch(block.action, block.params);
      results.push(result);
    }

    return results;
  }
}

// ─── Setup Built-in Capabilities ────────────────────────────────

export const capabilityRegistry = new CapabilityRegistry();

// Register built-in actions — wired to actual app functionality
capabilityRegistry.register('set_alert', 'Set a price alert', ['symbol', 'price'],
  async (params) => {
    window.dispatchEvent(new CustomEvent('tf:create-alert', {
      detail: { symbol: String(params.symbol), price: Number(params.price) },
    }));
    return `✅ Price alert set: ${params.symbol} at $${params.price}`;
  }
);

capabilityRegistry.register('add_journal', 'Save analysis to journal', ['content'],
  async (params) => {
    window.dispatchEvent(new CustomEvent('tf:add-journal-entry', {
      detail: { content: String(params.content), source: 'ai-copilot' },
    }));
    return `✅ Saved to journal: ${String(params.content).slice(0, 80)}...`;
  }
);

capabilityRegistry.register('fetch_trades', 'Fetch recent trades', ['symbol', 'count'],
  async (params) => {
    try {
      const { default: useJournalStore } = await import('@/state/useJournalStore');
      const trades = (useJournalStore as any).getState().trades || [];
      const symbol = params.symbol ? String(params.symbol).toUpperCase() : null;
      const count = Number(params.count) || 5;
      const filtered = symbol
        ? trades.filter((t: any) => t.symbol?.toUpperCase() === symbol).slice(-count)
        : trades.slice(-count);
      if (filtered.length === 0) return `No trades found${symbol ? ` for ${symbol}` : ''}.`;
      return filtered.map((t: any) =>
        `${t.symbol} ${t.side} — $${(t.pnl || 0).toFixed(2)} (${t.date || 'N/A'})`
      ).join('\n');
    } catch {
      return 'Could not access trade journal.';
    }
  }
);

capabilityRegistry.register('query_profile', 'Query trading profile', ['metric'],
  async () => {
    try {
      const { userProfileStore } = await import('./UserProfileStore');
      return userProfileStore.getSummaryForAI() || 'No profile data available yet.';
    } catch {
      return 'Profile store not available.';
    }
  }
);

// ─── Dispatcher Singleton ───────────────────────────────────────

export const actionDispatcher = new ActionDispatcher(capabilityRegistry);
export default actionDispatcher;
