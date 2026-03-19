// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist I/O (Sprint 92)
//
// Export/Import watchlists as JSON or CSV files.
//
// Usage:
//   import { watchlistIO } from './WatchlistIO';
//   watchlistIO.exportJSON(symbols, 'my-watchlist');
//   const imported = await watchlistIO.importJSON(file);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface WatchlistEntry {
  symbol: string;
  name?: string;
  notes?: string;
  addedAt?: string;
}

export interface ImportResult {
  symbols: WatchlistEntry[];
  format: 'json' | 'csv';
  count: number;
  errors: string[];
}

// ─── IO ─────────────────────────────────────────────────────────

class WatchlistIO {
  // ─── Export ──────────────────────────────────────────────────

  exportJSON(symbols: WatchlistEntry[], filename = 'charEdge-watchlist'): void {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'charEdge',
      symbols,
    };

    this._download(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
  }

  exportCSV(symbols: WatchlistEntry[], filename = 'charEdge-watchlist'): void {
    const header = 'Symbol,Name,Notes,Added';
    const rows = symbols.map(s =>
      `${this._csvEscape(s.symbol)},${this._csvEscape(s.name || '')},${this._csvEscape(s.notes || '')},${s.addedAt || ''}`
    );

    this._download([header, ...rows].join('\n'), `${filename}.csv`, 'text/csv');
  }

  // ─── Import ──────────────────────────────────────────────────

  async importJSON(file: File): Promise<ImportResult> {
    const errors: string[] = [];

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let symbols: WatchlistEntry[];

      if (Array.isArray(data)) {
        symbols = data.map(item => this._normalizeEntry(item));
      } else if (data.symbols && Array.isArray(data.symbols)) {
        symbols = data.symbols.map((item: unknown) => this._normalizeEntry(item));
      } else {
        errors.push('Unrecognized JSON format');
        return { symbols: [], format: 'json', count: 0, errors };
      }

      const valid = this._deduplicate(symbols.filter(s => s.symbol));
      return { symbols: valid, format: 'json', count: valid.length, errors };
    } catch (e) {
      errors.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown'}`);
      return { symbols: [], format: 'json', count: 0, errors };
    }
  }

  async importCSV(file: File): Promise<ImportResult> {
    const errors: string[] = [];

    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Detect if first line is header
      const firstLine = lines[0].toLowerCase();
      const startIdx = firstLine.includes('symbol') ? 1 : 0;

      const symbols: WatchlistEntry[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const cols = this._parseCSVLine(lines[i]);
        if (cols[0]) {
          symbols.push({
            symbol: cols[0].toUpperCase().trim(),
            name: cols[1]?.trim() || undefined,
            notes: cols[2]?.trim() || undefined,
            addedAt: cols[3]?.trim() || undefined,
          });
        }
      }

      const valid = this._deduplicate(symbols);
      return { symbols: valid, format: 'csv', count: valid.length, errors };
    } catch (e) {
      errors.push(`Parse error: ${e instanceof Error ? e.message : 'Unknown'}`);
      return { symbols: [], format: 'csv', count: 0, errors };
    }
  }

  /**
   * Auto-detect format and import.
   */
  async importFile(file: File): Promise<ImportResult> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') return this.importJSON(file);
    if (ext === 'csv' || ext === 'txt') return this.importCSV(file);

    // Try JSON first, then CSV
    try {
      return await this.importJSON(file);
    } catch {
      return this.importCSV(file);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private _download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private _csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  private _parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private _normalizeEntry(item: unknown): WatchlistEntry {
    if (typeof item === 'string') {
      return { symbol: item.toUpperCase() };
    }
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        symbol: String(obj.symbol || obj.ticker || obj.id || '').toUpperCase(),
        name: typeof obj.name === 'string' ? obj.name : undefined,
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
      };
    }
    return { symbol: '' };
  }

  private _deduplicate(entries: WatchlistEntry[]): WatchlistEntry[] {
    const seen = new Set<string>();
    return entries.filter(e => {
      if (seen.has(e.symbol)) return false;
      seen.add(e.symbol);
      return true;
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const watchlistIO = new WatchlistIO();
export default watchlistIO;
