// ═══════════════════════════════════════════════════════════════════
// charEdge — Backtest Panel
// Configuration sidebar for setting up and running strategy backtests.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { PRESET_STRATEGIES } from '../../../../charting_library/core/BacktestEngine.js';

const STRATEGY_LIST = Object.entries(PRESET_STRATEGIES).map(([id, s]) => ({
  id, name: s.name, description: s.description,
}));

export default function BacktestPanel({ bars, onClose }) {
  const { config, setConfig, runBacktest: run, isRunning, error } = useBacktestStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleRun = useCallback(() => {
    if (!bars?.length) return;
    run(bars);
  }, [bars, run]);

  return (
    <div className="tf-backtest-panel">
      {/* Header */}
      <div className="tf-backtest-panel__header">
        <div className="tf-backtest-panel__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
            <path d="M8.5 2h7"/><path d="M7 16h10"/>
          </svg>
          Strategy Tester
        </div>
        <button className="tf-backtest-panel__close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="tf-backtest-panel__body">
        {/* Strategy Selector */}
        <div className="tf-backtest-field">
          <label className="tf-backtest-field__label">Strategy</label>
          <select
            className="tf-backtest-field__select"
            value={config.strategyId}
            onChange={e => setConfig({ strategyId: e.target.value })}
          >
            {STRATEGY_LIST.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="tf-backtest-field__hint">
            {STRATEGY_LIST.find(s => s.id === config.strategyId)?.description}
          </div>
        </div>

        {/* Initial Capital */}
        <div className="tf-backtest-field">
          <label className="tf-backtest-field__label">Initial Capital</label>
          <div className="tf-backtest-field__input-group">
            <span className="tf-backtest-field__prefix">$</span>
            <input
              type="number"
              className="tf-backtest-field__input"
              value={config.initialCapital}
              onChange={e => setConfig({ initialCapital: parseFloat(e.target.value) || 10000 })}
              min={100}
              step={1000}
            />
          </div>
        </div>

        {/* Position Size */}
        <div className="tf-backtest-field">
          <label className="tf-backtest-field__label">Position Size</label>
          <div className="tf-backtest-field__input-group">
            <input
              type="number"
              className="tf-backtest-field__input"
              value={config.positionSizePercent}
              onChange={e => setConfig({ positionSizePercent: Math.min(100, Math.max(1, parseFloat(e.target.value) || 100)) })}
              min={1}
              max={100}
              step={5}
            />
            <span className="tf-backtest-field__suffix">%</span>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          className="tf-backtest-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾' : '▸'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="tf-backtest-advanced">
            {/* Commission */}
            <div className="tf-backtest-field tf-backtest-field--small">
              <label className="tf-backtest-field__label">Commission (per trade)</label>
              <div className="tf-backtest-field__input-group">
                <span className="tf-backtest-field__prefix">$</span>
                <input
                  type="number"
                  className="tf-backtest-field__input"
                  value={config.commissionPerTrade}
                  onChange={e => setConfig({ commissionPerTrade: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.5}
                />
              </div>
            </div>

            {/* Commission % */}
            <div className="tf-backtest-field tf-backtest-field--small">
              <label className="tf-backtest-field__label">Commission %</label>
              <div className="tf-backtest-field__input-group">
                <input
                  type="number"
                  className="tf-backtest-field__input"
                  value={config.commissionPercent}
                  onChange={e => setConfig({ commissionPercent: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
                  max={1}
                />
                <span className="tf-backtest-field__suffix">%</span>
              </div>
            </div>

            {/* Slippage */}
            <div className="tf-backtest-field tf-backtest-field--small">
              <label className="tf-backtest-field__label">Slippage %</label>
              <div className="tf-backtest-field__input-group">
                <input
                  type="number"
                  className="tf-backtest-field__input"
                  value={config.slippagePercent}
                  onChange={e => setConfig({ slippagePercent: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
                  max={2}
                />
                <span className="tf-backtest-field__suffix">%</span>
              </div>
            </div>
          </div>
        )}

        {/* Data Info */}
        <div className="tf-backtest-data-info">
          <span>📊 {bars?.length || 0} bars loaded</span>
        </div>

        {/* Error */}
        {error && (
          <div className="tf-backtest-error">{error}</div>
        )}

        {/* Run Button */}
        <button
          className="tf-backtest-run-btn"
          onClick={handleRun}
          disabled={isRunning || !bars?.length}
        >
          {isRunning ? (
            <span className="tf-backtest-run-btn__spinner">⟳</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
          {isRunning ? 'Running...' : 'Run Backtest'}
        </button>
      </div>
    </div>
  );
}
