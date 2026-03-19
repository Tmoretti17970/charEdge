// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Benchmark Card (Sprint 8)
//
// Shows AI model info, inference speed, memory, compatibility.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';

function ModelBenchmarkCard() {
  const [benchmarking, setBenchmarking] = useState(false);
  const [results, setResults] = useState(null);

  const runBenchmark = useCallback(async () => {
    setBenchmarking(true);
    // Simulate benchmark
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
    <Card style={{ padding: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Model Info
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            On-device AI capabilities
          </div>
        </div>
        <Btn variant="ghost" onClick={runBenchmark} disabled={benchmarking}
          style={{ fontSize: 11, padding: '4px 12px' }}>
          {benchmarking ? '⏱ Running…' : '🔬 Benchmark'}
        </Btn>
      </div>

      {/* Model details */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        marginBottom: 14,
      }}>
        <div style={{ padding: 10, borderRadius: radii.sm, background: C.bd + '08' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M }}>ENGINE</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, marginTop: 2 }}>
            In-Browser AI
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: radii.sm, background: C.bd + '08' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M }}>TYPE</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F, marginTop: 2 }}>
            Pattern + Context
          </div>
        </div>
      </div>

      {/* Benchmark results */}
      {results && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
          marginBottom: 14,
        }}>
          {[
            { label: 'Inference', value: `${results.inferenceSpeed}ms`, icon: '⚡' },
            { label: 'Memory', value: `${results.memoryUsage}MB`, icon: '💾' },
            { label: 'Tokens/sec', value: `${results.tokensPerSec}`, icon: '📊' },
          ].map((metric) => (
            <div key={metric.label} style={{
              padding: 10, borderRadius: radii.sm,
              background: C.b + '06', border: `1px solid ${C.b}15`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{metric.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: M }}>
                {metric.value}
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capabilities */}
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 8 }}>
        Capabilities
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {capabilities.map((cap) => (
          <span
            key={cap.name}
            style={{
              padding: '3px 10px', borderRadius: 20,
              background: cap.status ? C.g + '12' : C.bd + '15',
              color: cap.status ? C.g : C.t3,
              fontSize: 10, fontWeight: 600, fontFamily: F,
              border: `1px solid ${cap.status ? C.g + '25' : C.bd + '20'}`,
            }}
          >
            {cap.status ? '✓' : '○'} {cap.name}
          </span>
        ))}
      </div>
    </Card>
  );
}

export default React.memo(ModelBenchmarkCard);
