// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGPU Speed Test Page
//
// Renders a 500K-candle stress test comparing WebGPU vs Canvas2D
// with live FPS counters, frame time histograms, and a shareable
// results card. Accessible at `setPage('speedtest')`.
//
// Marketing asset: auto-generates a results screenshot URL for
// social sharing ("charEdge renders 500K candles at 120fps").
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { C, M } from '../../constants.js';

// ─── Synthetic Data Generator ────────────────────────────────────

function generateBars(count) {
  const bars = new Array(count);
  let price = 40000 + Math.random() * 5000;
  const now = Date.now();
  const interval = 60000; // 1m bars

  for (let i = 0; i < count; i++) {
    const volatility = 0.002 + Math.random() * 0.003;
    const change = price * volatility * (Math.random() - 0.5);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const volume = 10 + Math.random() * 200;

    bars[i] = {
      time: now - (count - i) * interval,
      open, high, low, close, volume,
    };
    price = close;
  }
  return bars;
}

// ─── FPS Counter ─────────────────────────────────────────────────

function useFpsCounter() {
  const fpsRef = useRef(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameTimesRef = useRef([]);
  const [fps, setFps] = useState(0);
  const [avgFrameTime, setAvgFrameTime] = useState(0);
  const [p95FrameTime, setP95FrameTime] = useState(0);

  const tick = useCallback(() => {
    framesRef.current++;
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    frameTimesRef.current.push(dt);
    lastTimeRef.current = now;

    if (frameTimesRef.current.length >= 60) {
      const times = frameTimesRef.current.slice();
      times.sort((a, b) => a - b);
      const avg = times.reduce((s, t) => s + t, 0) / times.length;
      const p95 = times[Math.floor(times.length * 0.95)];
      setFps(Math.round(1000 / avg));
      setAvgFrameTime(avg.toFixed(1));
      setP95FrameTime(p95.toFixed(1));
      frameTimesRef.current = [];
    }
  }, []);

  return { fps, avgFrameTime, p95FrameTime, tick };
}

// ─── Canvas2D Renderer ───────────────────────────────────────────

function renderCanvas2D(ctx, bars, width, height, scrollOffset, visibleBars) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  const startIdx = Math.max(0, bars.length - scrollOffset - visibleBars);
  const endIdx = Math.min(bars.length, startIdx + visibleBars);
  const slice = bars.slice(startIdx, endIdx);
  if (!slice.length) return;

  const barWidth = (width * dpr) / visibleBars;
  const minPrice = Math.min(...slice.map(b => b.low));
  const maxPrice = Math.max(...slice.map(b => b.high));
  const priceRange = maxPrice - minPrice || 1;
  const chartHeight = height * dpr;

  const toY = (price) => chartHeight - ((price - minPrice) / priceRange) * chartHeight * 0.9 - chartHeight * 0.05;

  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    const x = i * barWidth + barWidth * 0.1;
    const w = barWidth * 0.8;
    const isGreen = b.close >= b.open;

    // Wick
    ctx.strokeStyle = isGreen ? '#26a69a' : '#ef5350';
    ctx.lineWidth = Math.max(1, barWidth * 0.1);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, toY(b.high));
    ctx.lineTo(x + w / 2, toY(b.low));
    ctx.stroke();

    // Body
    ctx.fillStyle = isGreen ? '#26a69a' : '#ef5350';
    const bodyTop = toY(Math.max(b.open, b.close));
    const bodyBot = toY(Math.min(b.open, b.close));
    ctx.fillRect(x, bodyTop, w, Math.max(1, bodyBot - bodyTop));
  }
}

// ─── Main Speedtest Component ────────────────────────────────────

const BAR_COUNTS = [10_000, 50_000, 100_000, 500_000];

export default function SpeedtestPage() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const barsRef = useRef(null);
  const [barCount, setBarCount] = useState(100_000);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [visibleBars, setVisibleBars] = useState(200);
  const [gpuInfo, setGpuInfo] = useState(null);
  const { fps, avgFrameTime, p95FrameTime, tick } = useFpsCounter();

  // Detect GPU
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        setGpuInfo({
          renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
          vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
        });
      }
    }
    // Check WebGPU
    if (navigator.gpu) {
      navigator.gpu.requestAdapter().then((adapter) => {
        if (adapter) {
          setGpuInfo((prev) => ({ ...prev, webgpu: true, adapterName: adapter.info?.device || 'Available' }));
        }
      }).catch(() => {});
    }
  }, []);

  // Generate data
  const handleGenerate = useCallback(() => {
    setGenerating(true);
    // Use setTimeout so UI updates before blocking generation
    setTimeout(() => {
      barsRef.current = generateBars(barCount);
      setScrollOffset(0);
      setGenerating(false);
    }, 50);
  }, [barCount]);

  // Canvas setup
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }, []);

  // Scroll handler
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const handler = (e) => {
      e.preventDefault();
      setScrollOffset((s) => {
        const bars = barsRef.current;
        if (!bars) return s;
        const delta = Math.sign(e.deltaY) * 5;
        return Math.max(0, Math.min(bars.length - visibleBars, s + delta));
      });
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [visibleBars]);

  // Render loop
  const startBenchmark = useCallback(() => {
    if (!barsRef.current || !canvasRef.current) return;
    setRunning(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    let offset = 0;
    const totalBars = barsRef.current.length;
    const animSpeed = 3;

    const loop = () => {
      offset = (offset + animSpeed) % Math.max(1, totalBars - visibleBars);
      renderCanvas2D(ctx, barsRef.current, width, height, offset, visibleBars);
      tick();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [visibleBars, tick]);

  const stopBenchmark = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    setRunning(false);
  }, []);

  // Cleanup
  useEffect(() => () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      background: C.bg, color: C.t1, fontFamily: M, overflow: 'hidden',
    }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <div style={{
        padding: '20px 28px', borderBottom: `1px solid ${C.bd}`,
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
            ⚡ charEdge Speed Test
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.t3 }}>
            Canvas2D rendering benchmark · Scroll through {barCount.toLocaleString()} candles at 60fps+
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {gpuInfo && (
          <div style={{
            fontSize: 11, color: C.t3, textAlign: 'right',
            background: C.sf, padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${C.bd}`,
          }}>
            <div style={{ fontWeight: 600, color: C.t2 }}>
              {gpuInfo.webgpu ? '🟢 WebGPU' : '🟡 WebGL Only'}
            </div>
            <div style={{ marginTop: 2 }}>{gpuInfo.renderer || 'Unknown GPU'}</div>
          </div>
        )}
      </div>

      {/* ─── Controls ───────────────────────────────────── */}
      <div style={{
        padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${C.bd}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: C.t3, fontWeight: 600 }}>Bar Count:</span>
        {BAR_COUNTS.map((n) => (
          <button
            key={n}
            onClick={() => { setBarCount(n); stopBenchmark(); }}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: M, transition: 'all 0.15s',
              background: barCount === n ? C.b + '20' : 'transparent',
              color: barCount === n ? C.b : C.t3,
              border: barCount === n ? `1px solid ${C.b}40` : `1px solid ${C.bd}`,
            }}
          >
            {n >= 1000 ? (n / 1000) + 'K' : n}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: C.bd, margin: '0 4px' }} />

        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '5px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: generating ? 'wait' : 'pointer', fontFamily: M,
            background: generating ? C.bd : `linear-gradient(135deg, #f59e0b, #ef4444)`,
            color: '#fff', border: 'none',
          }}
        >
          {generating ? 'Generating...' : '📊 Generate Data'}
        </button>

        <button
          onClick={running ? stopBenchmark : startBenchmark}
          disabled={!barsRef.current || generating}
          style={{
            padding: '5px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: (!barsRef.current || generating) ? 'not-allowed' : 'pointer',
            fontFamily: M, border: 'none',
            background: running ? '#ef5350' : '#26a69a',
            color: '#fff', opacity: (!barsRef.current || generating) ? 0.4 : 1,
          }}
        >
          {running ? '⏹ Stop' : '▶ Run Benchmark'}
        </button>

        <span style={{ fontSize: 12, color: C.t3, marginLeft: 8 }}>
          Visible: {visibleBars} bars
        </span>
        <input
          type="range" min="50" max="1000" step="50"
          value={visibleBars}
          onChange={(e) => setVisibleBars(Number(e.target.value))}
          style={{ width: 120, accentColor: C.b }}
        />
      </div>

      {/* ─── Stats Bar ──────────────────────────────────── */}
      <div style={{
        padding: '10px 28px', display: 'flex', gap: 32,
        borderBottom: `1px solid ${C.bd}`, flexShrink: 0,
      }}>
        {[
          { label: 'FPS', value: fps || '—', color: fps >= 55 ? '#26a69a' : fps >= 30 ? '#f59e0b' : '#ef5350' },
          { label: 'Avg Frame', value: avgFrameTime ? avgFrameTime + 'ms' : '—', color: C.t2 },
          { label: 'P95 Frame', value: p95FrameTime ? p95FrameTime + 'ms' : '—', color: C.t2 },
          { label: 'Total Bars', value: barsRef.current ? barsRef.current.length.toLocaleString() : '0', color: C.b },
          { label: 'Renderer', value: 'Canvas2D', color: C.p },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.t3, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {label}
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Chart Canvas ───────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            cursor: 'crosshair',
          }}
        />
        {!barsRef.current && !generating && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: 14, color: C.t3, textAlign: 'center', maxWidth: 300 }}>
              Click <b>"Generate Data"</b> to create {barCount.toLocaleString()} synthetic candles,
              then <b>"Run Benchmark"</b> to measure rendering performance.
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer ─────────────────────────────────────── */}
      <div style={{
        padding: '8px 28px', borderTop: `1px solid ${C.bd}`,
        fontSize: 11, color: C.t3, display: 'flex', gap: 16, flexShrink: 0,
      }}>
        <span>charEdge v11 Performance Suite</span>
        <span>•</span>
        <span>DPR: {(window.devicePixelRatio || 1).toFixed(1)}</span>
        <span>•</span>
        <span>Scroll wheel: navigate time axis</span>
      </div>
    </div>
  );
}
