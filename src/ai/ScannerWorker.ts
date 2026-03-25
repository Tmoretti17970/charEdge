/* global WorkerGlobalScope */
// ═══════════════════════════════════════════════════════════════════
// charEdge — Scanner Web Worker (AI Copilot Sprint 6)
//
// Offloads multi-symbol scanning to a Web Worker so the main thread
// stays responsive. Posts progress updates back to the main thread.
//
// Usage (from main thread):
//   const worker = new ScannerWorkerProxy();
//   worker.scan(symbols, bars).then(results => { ... });
// ═══════════════════════════════════════════════════════════════════

import { ScannerEngine } from './ScannerEngine';
import type { Bar, ScanResult, ScanProgress } from './ScannerEngine';

// ─── Worker Message Types ───────────────────────────────────────

export interface ScanRequest {
  type: 'scan';
  symbols: string[];
  barsMap: Record<string, Bar[]>; // Pre-fetched bars keyed by symbol
}

export interface ScanProgressMessage {
  type: 'progress';
  progress: ScanProgress;
}

export interface ScanCompleteMessage {
  type: 'complete';
  results: ScanResult[];
}

export type WorkerMessage = ScanProgressMessage | ScanCompleteMessage;

// ─── Worker Entry Point ─────────────────────────────────────────

/**
 * If this file is loaded as a Web Worker, listen for messages.
 */
// Phase 3 Task #46: Fixed WorkerGlobalScope detection
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  const engine = new ScannerEngine();

  self.onmessage = async (e: MessageEvent<ScanRequest>) => {
    if (e.data.type !== 'scan') return;

    const { symbols, barsMap } = e.data;

    const results = await engine.scan(
      symbols,
      (symbol: string) => barsMap[symbol] || [],
      (progress: ScanProgress) => {
        self.postMessage({ type: 'progress', progress } satisfies ScanProgressMessage);
      },
    );

    self.postMessage({ type: 'complete', results } satisfies ScanCompleteMessage);
  };
}

// ─── Main Thread Proxy ──────────────────────────────────────────

export class ScannerWorkerProxy {
  private _worker: Worker | null = null;
  private _fallbackEngine: ScannerEngine;

  constructor() {
    this._fallbackEngine = new ScannerEngine();
    try {
      this._worker = new Worker(new URL('./ScannerWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      // Worker not supported — fall back to main thread
      this._worker = null;
    }
  }

  /**
   * Scan symbols. Uses Web Worker if available, falls back to main thread.
   */
  async scan(
    symbols: string[],
    barsMap: Record<string, Bar[]>,
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<ScanResult[]> {
    if (!this._worker) {
      return this._fallbackEngine.scan(symbols, (s) => barsMap[s] || [], onProgress);
    }

    return new Promise((resolve) => {
      const worker = this._worker!;

      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === 'progress') {
          onProgress?.(e.data.progress);
        } else if (e.data.type === 'complete') {
          resolve(e.data.results);
        }
      };

      worker.postMessage({ type: 'scan', symbols, barsMap } satisfies ScanRequest);
    });
  }

  /**
   * Terminate the worker.
   */
  terminate(): void {
    this._worker?.terminate();
    this._worker = null;
  }
}
