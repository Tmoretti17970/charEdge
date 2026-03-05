/// <reference types="vite/client" />

// ═══════════════════════════════════════════════════════════════════
// charEdge — Structured Logger
//
// Unified logging with context tags and level filtering.
// Dev: Pretty console output with color-coded tags.
// Prod: Suppress debug/info, pipe errors to globalErrorHandler.
//
// Usage:
//   import { logger } from '../utils/logger.js';
//   logger.engine.info('Render complete', { fps: 60 });
//   logger.data.warn('Cache miss', { symbol: 'BTCUSDT' });
//   logger.boot.error('Failed to hydrate', err);
// ═══════════════════════════════════════════════════════════════════

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** A tagged logger with methods for each log level. */
export interface TaggedLogger {
  debug(msg: string, extra?: unknown): void;
  info(msg: string, extra?: unknown): void;
  warn(msg: string, extra?: unknown): void;
  error(msg: string, extra?: unknown): void;
}

/** The full logger API with pre-configured tagged loggers. */
export interface Logger {
  engine: TaggedLogger;
  data: TaggedLogger;
  webgl: TaggedLogger;
  worker: TaggedLogger;
  store: TaggedLogger;
  ui: TaggedLogger;
  boot: TaggedLogger;
  network: TaggedLogger;
  create(tag: string): TaggedLogger;
}

interface PipelineLogger {
  debug(tag: string, msg: string, err?: Error | null): void;
  info(tag: string, msg: string, err?: Error | null): void;
  warn(tag: string, msg: string, err?: Error | null): void;
  error(tag: string, msg: string, err?: Error | null): void;
}

declare const process: { env?: { NODE_ENV?: string } } | undefined;

const isProd: boolean = typeof import.meta !== 'undefined'
  ? !import.meta.env?.DEV
  : typeof process !== 'undefined' && process?.env?.NODE_ENV === 'production';

// ─── Log Levels ──────────────────────────────────────────────────
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: number = isProd ? LEVELS.warn : LEVELS.debug;

// ─── Console Styling (dev only) ──────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  Engine:  '#e8642c',
  Data:    '#4fc3f7',
  WebGL:   '#ab47bc',
  Worker:  '#66bb6a',
  Store:   '#ffa726',
  UI:      '#ec407a',
  Boot:    '#26a69a',
  Network: '#5c6bc0',
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #888',
  info:  'color: #4fc3f7',
  warn:  'color: #ffa726; font-weight: bold',
  error: 'color: #ef5350; font-weight: bold',
};

// ─── Error Handler Integration ───────────────────────────────────
type ErrorReporter = (err: Error, context: { source: string; silent: boolean }) => void;
let _reportError: ErrorReporter | null = null;

function _getErrorReporter(): ErrorReporter | null {
  if (_reportError) return _reportError;
  try {
    const handler = (globalThis as Record<string, unknown>).__charEdge_errorHandler__ as
      { reportError?: ErrorReporter } | undefined;
    if (handler?.reportError) {
      _reportError = handler.reportError;
      return _reportError;
    }
  } catch (e) { logger.ui.warn('Operation failed', e); }
  return null;
}

// ─── Pipeline Logger Integration ─────────────────────────────────
let _pipelineLogger: PipelineLogger | null = null;

function _getPipelineLogger(): PipelineLogger | null {
  if (_pipelineLogger) return _pipelineLogger;
  try {
    const pl = (globalThis as Record<string, unknown>).__charEdge_pipelineLogger__ as
      PipelineLogger | undefined;
    if (pl) {
      _pipelineLogger = pl;
      return _pipelineLogger;
    }
  } catch (e) { logger.ui.warn('Operation failed', e); }
  return null;
}

// ─── Core Log Function ───────────────────────────────────────────
function _log(level: LogLevel, tag: string, message: string, extra?: unknown): void {
  const numLevel = LEVELS[level] ?? LEVELS.info;
  if (numLevel < MIN_LEVEL) return;

  // Forward to DataPipelineLogger if available
  const pl = _getPipelineLogger();
  if (pl && typeof pl[level] === 'function') {
    pl[level](tag, message, extra instanceof Error ? extra : null);
  }

  // Console output (dev only for debug/info, always for warn/error)
  if (!isProd || numLevel >= LEVELS.warn) {
    const tagColor = TAG_COLORS[tag] || '#888';
    const prefix = `%c[${tag}]%c`;
    const tagStyle = `color: ${tagColor}; font-weight: bold`;
    const msgStyle = LEVEL_STYLES[level] || '';
    const consoleFn = level === 'debug' ? 'log' : level;

    if (extra !== undefined && extra !== null) {
      console[consoleFn](prefix, tagStyle, msgStyle, message, extra);
    } else {
      console[consoleFn](prefix, tagStyle, msgStyle, message);
    }
  }

  // Pipe errors to globalErrorHandler in production
  if (level === 'error') {
    const reporter = _getErrorReporter();
    if (reporter) {
      const err = extra instanceof Error ? extra : new Error(message);
      reporter(err, { source: tag, silent: true });
    }
  }
}

// ─── Tagged Logger Factory ───────────────────────────────────────
function createTaggedLogger(tag: string): TaggedLogger {
  return {
    debug: (msg, extra) => _log('debug', tag, msg, extra),
    info:  (msg, extra) => _log('info',  tag, msg, extra),
    warn:  (msg, extra) => _log('warn',  tag, msg, extra),
    error: (msg, extra) => _log('error', tag, msg, extra),
  };
}

// ─── Public API ──────────────────────────────────────────────────
export const logger: Logger = {
  engine:  createTaggedLogger('Engine'),
  data:    createTaggedLogger('Data'),
  webgl:   createTaggedLogger('WebGL'),
  worker:  createTaggedLogger('Worker'),
  store:   createTaggedLogger('Store'),
  ui:      createTaggedLogger('UI'),
  boot:    createTaggedLogger('Boot'),
  network: createTaggedLogger('Network'),

  // Create a custom-tagged logger
  create: (tag: string) => createTaggedLogger(tag),
};

// ─── Registration Hooks ──────────────────────────────────────────
export function registerErrorReporter(fn: ErrorReporter): void {
  _reportError = fn;
}

export function registerPipelineLogger(pl: PipelineLogger): void {
  _pipelineLogger = pl;
}

export default logger;
