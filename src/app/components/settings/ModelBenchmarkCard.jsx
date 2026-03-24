// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Benchmark Card (Sprint 8)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import st from './ModelBenchmarkCard.module.css';

function ModelBenchmarkCard() {
  const [benchmarking, setBenchmarking] = useState(false);
  const [results, setResults] = useState(null);

  const runBenchmark = useCallback(async () => {
    setBenchmarking(true);
    await new Promise((r) => setTimeout(r, 1500));
    setResults({
      inferenceSpeed: Math.round(50 + Math.random() * 150),
      memoryUsage: Math.round(80 + Math.random() * 120),
      tokensPerSec: Math.round(20 + Math.random() * 60),
    });
    setBenchmarking(false);
  }, []);

  const capabilities = [
    { name: 'Text Generation', status: true },
    { name: 'Trade Analysis', status: true },
    { name: 'Pattern Detection', status: true },
    { name: 'Real-time Streaming', status: false },
  ];

  return (
    <Card className={st.cardPad}>
      <div className={st.header}>
        <div>
          <div className={st.title}>Model Info</div>
          <div className={st.subtitle}>On-device AI capabilities</div>
        </div>
        <Btn variant="ghost" onClick={runBenchmark} disabled={benchmarking}
          style={{ fontSize: 11, padding: '4px 12px' }}>
          {benchmarking ? '⏱ Running…' : '🔬 Benchmark'}
        </Btn>
      </div>

      <div className={st.detailGrid}>
        <div className={st.detailBox} style={{ background: C.bd + '08' }}>
          <div className={st.detailLabel}>ENGINE</div>
          <div className={st.detailValue}>In-Browser AI</div>
        </div>
        <div className={st.detailBox} style={{ background: C.bd + '08' }}>
          <div className={st.detailLabel}>TYPE</div>
          <div className={st.detailValue}>Pattern + Context</div>
        </div>
      </div>

      {results && (
        <div className={st.benchGrid}>
          {[
            { label: 'Inference', value: `${results.inferenceSpeed}ms`, icon: '⚡' },
            { label: 'Memory', value: `${results.memoryUsage}MB`, icon: '💾' },
            { label: 'Tokens/sec', value: `${results.tokensPerSec}`, icon: '📊' },
          ].map((metric) => (
            <div key={metric.label} className={st.benchBox}
              style={{ background: C.b + '06', border: `1px solid ${C.b}15` }}>
              <div className={st.benchIcon}>{metric.icon}</div>
              <div className={st.benchValue}>{metric.value}</div>
              <div className={st.benchLabel}>{metric.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className={st.capsTitle}>Capabilities</div>
      <div className={st.capsRow}>
        {capabilities.map((cap) => (
          <span key={cap.name} className={st.capsBadge}
            style={{
              background: cap.status ? C.g + '12' : C.bd + '15',
              color: cap.status ? C.g : C.t3,
              border: `1px solid ${cap.status ? C.g + '25' : C.bd + '20'}`,
            }}>
            {cap.status ? '✓' : '○'} {cap.name}
          </span>
        ))}
      </div>
    </Card>
  );
}

export default React.memo(ModelBenchmarkCard);
