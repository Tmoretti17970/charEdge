// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Analysis Panel
// Displays the AI chart analysis results in a premium overlay panel.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { analyzeChart } from '../../../../charting_library/ai/AIChartAnalysis.js';

export default function ChartAnalysisPanel({ bars, symbol, timeframe, onClose }) {
  const analysis = useMemo(() => {
    return analyzeChart(bars, symbol, timeframe);
  }, [bars, symbol, timeframe]);

  if (!analysis || analysis.error) {
    return (
      <div className="tf-analysis-panel tf-fade-scale">
        <div className="tf-analysis-panel__header">
          <span>📊 AI Chart Analysis</span>
          <button className="tf-analysis-panel__close" onClick={onClose}>✕</button>
        </div>
        <div className="tf-analysis-panel__empty">
          {analysis?.error || 'Not enough data for analysis'}
        </div>
      </div>
    );
  }

  return (
    <div className="tf-analysis-panel tf-fade-scale">
      {/* Header */}
      <div className="tf-analysis-panel__header">
        <div className="tf-analysis-panel__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          AI Chart Analysis
        </div>
        <button className="tf-analysis-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* Bias Badge */}
      <div className="tf-analysis-bias">
        <div className="tf-analysis-bias__score" style={{ color: analysis.biasColor }}>
          {analysis.biasScore}
        </div>
        <div className="tf-analysis-bias__label" style={{ color: analysis.biasColor }}>
          {analysis.bias}
        </div>
        <div className="tf-analysis-bias__meta">
          {symbol} · {timeframe} · ${analysis.price?.toFixed(2)}
        </div>
        {/* Bias gauge */}
        <div className="tf-analysis-gauge">
          <div className="tf-analysis-gauge__track">
            <div
              className="tf-analysis-gauge__fill"
              style={{
                width: `${analysis.biasScore}%`,
                background: `linear-gradient(90deg, #EF5350 0%, #FFA726 50%, #26A69A 100%)`,
              }}
            />
            <div className="tf-analysis-gauge__marker" style={{ left: `${analysis.biasScore}%` }} />
          </div>
          <div className="tf-analysis-gauge__labels">
            <span style={{ color: '#EF5350' }}>Bearish</span>
            <span style={{ color: '#26A69A' }}>Bullish</span>
          </div>
        </div>
      </div>

      {/* Analysis Sections */}
      <div className="tf-analysis-sections">
        {analysis.sections.map((section, idx) => (
          <div key={idx} className="tf-analysis-section">
            <div className="tf-analysis-section__title">{section.title}</div>
            {section.details.map((detail, i) => (
              <div key={i} className={`tf-analysis-detail tf-analysis-detail--${detail.sentiment}`}>
                <span className="tf-analysis-detail__dot" />
                <span>{detail.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Key Levels */}
      {analysis.keyLevels && (
        <div className="tf-analysis-key-levels">
          <div className="tf-analysis-section__title">🔑 Key Levels</div>
          <div className="tf-analysis-key-levels__grid">
            {analysis.keyLevels.sma20 && <KeyLevel label="SMA(20)" value={analysis.keyLevels.sma20} />}
            {analysis.keyLevels.sma50 && <KeyLevel label="SMA(50)" value={analysis.keyLevels.sma50} />}
            {analysis.keyLevels.sma200 && <KeyLevel label="SMA(200)" value={analysis.keyLevels.sma200} />}
            {analysis.keyLevels.rsi && <KeyLevel label="RSI(14)" value={analysis.keyLevels.rsi} decimals={1} />}
            {analysis.keyLevels.atr && <KeyLevel label="ATR(14)" value={analysis.keyLevels.atr} />}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyLevel({ label, value, decimals = 2 }) {
  return (
    <div className="tf-analysis-kl">
      <span className="tf-analysis-kl__label">{label}</span>
      <span className="tf-analysis-kl__value">{typeof value === 'number' ? value.toFixed(decimals) : value}</span>
    </div>
  );
}
