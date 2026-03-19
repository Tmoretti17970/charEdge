// ═══════════════════════════════════════════════════════════════════
// charEdge — Slash Command Parser (AI Copilot Sprint 15)
//
// Parses /commands from user input with auto-suggest.
// Routes to appropriate modules (scanner, journal, DNA, etc.)
//
// Usage:
//   import { slashCommandParser } from './SlashCommandParser';
//   const result = slashCommandParser.parse('/scan');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface ParsedCommand {
  isCommand: boolean;
  command: string;
  args: string[];
  rawInput: string;
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  category: string;
}

export interface CommandResult {
  command: string;
  success: boolean;
  output: string;
  data?: unknown;
}

// ─── Command Definitions ────────────────────────────────────────

const COMMANDS: CommandDefinition[] = [
  { name: 'scan', aliases: ['s'], description: 'Scan watchlist for opportunities', usage: '/scan', category: 'scanning' },
  { name: 'review', aliases: ['r'], description: 'Review last trade or specific symbol', usage: '/review [last|symbol]', category: 'journal' },
  { name: 'compare', aliases: ['cmp'], description: 'Compare setup to past similar trades', usage: '/compare [symbol]', category: 'journal' },
  { name: 'risk', aliases: ['rk'], description: 'Show current risk exposure', usage: '/risk', category: 'analysis' },
  { name: 'journal', aliases: ['j'], description: 'Search trade journal', usage: '/journal [query]', category: 'journal' },
  { name: 'dna', aliases: ['d'], description: 'Show Trader DNA profile', usage: '/dna', category: 'profile' },
  { name: 'sentiment', aliases: ['sent'], description: 'Fetch market sentiment', usage: '/sentiment', category: 'scanning' },
  { name: 'patterns', aliases: ['p'], description: 'Detect chart patterns', usage: '/patterns', category: 'analysis' },
  { name: 'help', aliases: ['h', '?'], description: 'Show available commands', usage: '/help', category: 'system' },
  { name: 'mode', aliases: ['m'], description: 'Switch conversation mode', usage: '/mode [quick|analysis|coaching|journal]', category: 'system' },
  { name: 'clear', aliases: ['c'], description: 'Clear chat history', usage: '/clear', category: 'system' },
];

// ─── Parser ─────────────────────────────────────────────────────

export class SlashCommandParser {
  /**
   * Parse user input for slash commands.
   */
  parse(input: string): ParsedCommand {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return { isCommand: false, command: '', args: [], rawInput: input };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const cmdName = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    // Resolve alias
    const resolved = this._resolveCommand(cmdName);

    return {
      isCommand: !!resolved,
      command: resolved || cmdName,
      args,
      rawInput: input,
    };
  }

  /**
   * Execute a parsed command.
   */
  async executeCommand(parsed: ParsedCommand): Promise<CommandResult> {
    if (!parsed.isCommand) {
      return { command: '', success: false, output: 'Not a command' };
    }

    switch (parsed.command) {
      case 'scan':
        return this._handleScan();
      case 'dna':
        return this._handleDNA();
      case 'sentiment':
        return this._handleSentiment();
      case 'patterns':
        return this._handlePatterns();
      case 'journal':
        return this._handleJournal(parsed.args.join(' '));
      case 'help':
        return this._handleHelp();
      case 'risk':
        return { command: 'risk', success: true, output: 'Risk analysis requires chart context. Open a chart to see risk exposure.' };
      case 'review':
        return { command: 'review', success: true, output: `Trade review: ${parsed.args[0] || 'last'} — Use Analysis mode for full post-trade review.` };
      case 'compare':
        return { command: 'compare', success: true, output: `Setup comparison for ${parsed.args[0] || 'current'} — searching journal for similar trades...` };
      case 'mode':
        return { command: 'mode', success: true, output: `Mode switch: ${parsed.args[0] || 'analysis'}`, data: { mode: parsed.args[0] || 'analysis' } };
      case 'clear':
        return { command: 'clear', success: true, output: 'Chat history cleared.', data: { action: 'clear' } };
      default:
        return { command: parsed.command, success: false, output: `Unknown command: /${parsed.command}. Type /help for available commands.` };
    }
  }

  /**
   * Get command suggestions for autocomplete.
   */
  getCommandSuggestions(partial: string): CommandDefinition[] {
    if (!partial.startsWith('/')) return [];
    const search = partial.slice(1).toLowerCase();
    if (!search) return COMMANDS;

    return COMMANDS.filter(cmd =>
      cmd.name.startsWith(search) ||
      cmd.aliases.some(a => a.startsWith(search))
    );
  }

  /**
   * Get all available commands.
   */
  getCommands(): CommandDefinition[] {
    return [...COMMANDS];
  }

  // ── Command Handlers ────────────────────────────────────────

  private async _handleScan(): Promise<CommandResult> {
    try {
      const { scannerEngine } = await import('./ScannerEngine');
      const summary = scannerEngine.getScanSummaryForAI();
      return { command: 'scan', success: true, output: summary || 'No scan results available. Run a scan from the Markets tab.' };
    } catch {
      return { command: 'scan', success: true, output: 'Scanner not initialized. Visit the Markets tab to start scanning.' };
    }
  }

  private async _handleDNA(): Promise<CommandResult> {
    try {
      const { traderDNA } = await import('./TraderDNA');
      const dna = traderDNA.getDNAForPrompt();
      return { command: 'dna', success: true, output: dna || 'Not enough trade data to generate DNA. Complete at least 3 trades.' };
    } catch {
      return { command: 'dna', success: true, output: 'Trader DNA module not available.' };
    }
  }

  private async _handleSentiment(): Promise<CommandResult> {
    try {
      const { sentimentFeed } = await import('./SentimentFeed');
      const result = await sentimentFeed.fetchSentiment();
      return { command: 'sentiment', success: true, output: result.summary, data: result };
    } catch {
      return { command: 'sentiment', success: true, output: 'Sentiment feeds unavailable. Check your network connection.' };
    }
  }

  private async _handlePatterns(): Promise<CommandResult> {
    try {
      const { patternCNN } = await import('./PatternCNN');
      // Would need bars from chart — return status
      return { command: 'patterns', success: true, output: `Pattern detector ready (${patternCNN.isModelLoaded() ? 'ONNX' : 'rule-based'} mode). Open a chart to detect patterns.` };
    } catch {
      return { command: 'patterns', success: true, output: 'Pattern detector not available.' };
    }
  }

  private async _handleJournal(query: string): Promise<CommandResult> {
    if (!query) {
      return { command: 'journal', success: true, output: 'Usage: /journal [search query]\nExample: /journal BTC winning trades' };
    }
    return { command: 'journal', success: true, output: `Searching journal for: "${query}" — Switch to Journal mode for full RAG-powered search.` };
  }

  private _handleHelp(): CommandResult {
    const lines = COMMANDS.map(c => `\`${c.usage}\` — ${c.description}`);
    return { command: 'help', success: true, output: `**Available Commands:**\n${lines.join('\n')}` };
  }

  // ── Internal ────────────────────────────────────────────────

  private _resolveCommand(name: string): string | null {
    for (const cmd of COMMANDS) {
      if (cmd.name === name || cmd.aliases.includes(name)) return cmd.name;
    }
    return null;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const slashCommandParser = new SlashCommandParser();
export default slashCommandParser;
