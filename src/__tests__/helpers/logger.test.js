// ═══════════════════════════════════════════════════════════════════
// Logger — Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Structured Logger', () => {
  let loggerModule;

  beforeEach(async () => {
    // Fresh import each test to reset module state
    loggerModule = await import('../../utils/logger.js');
  });

  it('exports logger with all expected tags', () => {
    const { logger } = loggerModule;
    expect(logger).toBeDefined();
    expect(logger.engine).toBeDefined();
    expect(logger.data).toBeDefined();
    expect(logger.webgl).toBeDefined();
    expect(logger.worker).toBeDefined();
    expect(logger.store).toBeDefined();
    expect(logger.ui).toBeDefined();
    expect(logger.boot).toBeDefined();
    expect(logger.network).toBeDefined();
  });

  it('each tag has debug/info/warn/error methods', () => {
    const { logger } = loggerModule;
    const tags = ['engine', 'data', 'webgl', 'worker', 'store', 'ui', 'boot', 'network'];
    for (const tag of tags) {
      expect(typeof logger[tag].debug).toBe('function');
      expect(typeof logger[tag].info).toBe('function');
      expect(typeof logger[tag].warn).toBe('function');
      expect(typeof logger[tag].error).toBe('function');
    }
  });

  it('logger.create() returns a custom tagged logger', () => {
    const { logger } = loggerModule;
    const custom = logger.create('MyModule');
    expect(custom).toBeDefined();
    expect(typeof custom.info).toBe('function');
    expect(typeof custom.error).toBe('function');
  });

  it('calling logger methods does not throw', () => {
    const { logger } = loggerModule;
    expect(() => logger.boot.info('test message')).not.toThrow();
    expect(() => logger.data.warn('warning message')).not.toThrow();
    expect(() => logger.engine.error('error message', new Error('test'))).not.toThrow();
    expect(() => logger.ui.debug('debug message', { extra: true })).not.toThrow();
  });

  it('registerErrorReporter accepts a function', () => {
    const { registerErrorReporter } = loggerModule;
    expect(() => registerErrorReporter(() => {})).not.toThrow();
  });

  it('registerPipelineLogger accepts an object', () => {
    const { registerPipelineLogger } = loggerModule;
    expect(() => registerPipelineLogger({ info: () => {}, error: () => {} })).not.toThrow();
  });

  it('pipes errors to registered error reporter', () => {
    const { logger, registerErrorReporter } = loggerModule;
    const spy = vi.fn();
    registerErrorReporter(spy);

    logger.engine.error('Something broke', new Error('test error'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'Engine', silent: true })
    );
  });

  it('pipes log entries to registered pipeline logger', () => {
    const { logger, registerPipelineLogger } = loggerModule;
    const mockPL = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    registerPipelineLogger(mockPL);

    logger.data.warn('cache miss');

    expect(mockPL.warn).toHaveBeenCalledTimes(1);
    expect(mockPL.warn).toHaveBeenCalledWith('Data', 'cache miss', null);
  });
});
