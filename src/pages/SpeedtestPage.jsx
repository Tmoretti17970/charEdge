// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGPU Speed Test Page v2
//
// Triple-renderer benchmark: WebGPU vs WebGL vs Canvas2D
// with live FPS counters, frame time stats, GPU adapter info,
// and up to 1M candle stress tests.
//
// Each renderer uses its own canvas element because browser APIs
// don't allow mixing canvas contexts (2D/WebGL/WebGPU) on one canvas.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { C, M, F, GLASS, DEPTH } from '../constants.js';

// ─── Synthetic Data Generator ────────────────────────────────────

function generateBars(count) {
  // Packed OHLCV in Float64Array: [open, high, low, close, volume, ...]
  const bars = new Float64Array(count * 5);
  let price = 40000 + Math.random() * 5000;
  for (let i = 0; i < count; i++) {
    const volatility = 0.002 + Math.random() * 0.003;
    const change = price * volatility * (Math.random() - 0.5);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const volume = 10 + Math.random() * 200;
    const offset = i * 5;
    bars[offset] = open;
    bars[offset + 1] = high;
    bars[offset + 2] = low;
    bars[offset + 3] = close;
    bars[offset + 4] = volume;
    price = close;
  }
  return bars;
}

// ── Helpers ───────────────────────────────────────────────────────

function getSliceRange(barCount, scrollOffset, visibleBars) {
  const startIdx = Math.max(0, barCount - scrollOffset - visibleBars);
  const endIdx = Math.min(barCount, startIdx + visibleBars);
  return { startIdx, endIdx };
}

function getSliceMinMax(bars, startIdx, endIdx) {
  let minPrice = Infinity, maxPrice = -Infinity;
  for (let i = startIdx; i < endIdx; i++) {
    const high = bars[i * 5 + 1];
    const low = bars[i * 5 + 2];
    if (high > maxPrice) maxPrice = high;
    if (low < minPrice) minPrice = low;
  }
  return { minPrice, maxPrice };
}

// ─── FPS Counter ─────────────────────────────────────────────────

function useFpsCounter() {
  const lastTimeRef = useRef(performance.now());
  const frameTimesRef = useRef([]);
  const [stats, setStats] = useState({ fps: 0, avgFrameTime: 0, p95FrameTime: 0, p1FrameTime: 0 });

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    frameTimesRef.current.push(dt);

    if (frameTimesRef.current.length >= 60) {
      const times = frameTimesRef.current.slice().sort((a, b) => a - b);
      const avg = times.reduce((s, t) => s + t, 0) / times.length;
      const p95 = times[Math.floor(times.length * 0.95)];
      const p1 = times[Math.floor(times.length * 0.01)];
      setStats({
        fps: Math.round(1000 / avg),
        avgFrameTime: avg.toFixed(1),
        p95FrameTime: p95.toFixed(1),
        p1FrameTime: p1.toFixed(1),
      });
      frameTimesRef.current = [];
    }
  }, []);

  const reset = useCallback(() => {
    frameTimesRef.current = [];
    lastTimeRef.current = performance.now();
    setStats({ fps: 0, avgFrameTime: 0, p95FrameTime: 0, p1FrameTime: 0 });
  }, []);

  return { ...stats, tick, reset };
}

// ─── Canvas2D Renderer ───────────────────────────────────────────

function renderCanvas2D(ctx, bars, barCount, width, height, scrollOffset, visibleBars) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  const { startIdx, endIdx } = getSliceRange(barCount, scrollOffset, visibleBars);
  const sliceLen = endIdx - startIdx;
  if (!sliceLen) return;

  const { minPrice, maxPrice } = getSliceMinMax(bars, startIdx, endIdx);
  const priceRange = maxPrice - minPrice || 1;
  const chartHeight = height * dpr;
  const barWidth = (width * dpr) / visibleBars;
  const toY = (price) => chartHeight - ((price - minPrice) / priceRange) * chartHeight * 0.9 - chartHeight * 0.05;

  for (let i = 0; i < sliceLen; i++) {
    const off = (startIdx + i) * 5;
    const open = bars[off], high = bars[off + 1], low = bars[off + 2], close = bars[off + 3];
    const x = i * barWidth + barWidth * 0.1;
    const w = barWidth * 0.8;
    const isGreen = close >= open;

    ctx.strokeStyle = isGreen ? '#26a69a' : '#ef5350';
    ctx.lineWidth = Math.max(1, barWidth * 0.1);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, toY(high));
    ctx.lineTo(x + w / 2, toY(low));
    ctx.stroke();

    ctx.fillStyle = isGreen ? '#26a69a' : '#ef5350';
    const bodyTop = toY(Math.max(open, close));
    const bodyBot = toY(Math.min(open, close));
    ctx.fillRect(x, bodyTop, w, Math.max(1, bodyBot - bodyTop));
  }
}

// ─── WebGL Renderer ──────────────────────────────────────────────

const GL_VERT = `
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0, 1);
  v_color = a_color;
}`;

const GL_FRAG = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`;

function initWebGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    || canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, GL_VERT);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, GL_FRAG);
  gl.compileShader(fs);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  return {
    gl, prog,
    posLoc: gl.getAttribLocation(prog, 'a_position'),
    colLoc: gl.getAttribLocation(prog, 'a_color'),
    resLoc: gl.getUniformLocation(prog, 'u_resolution'),
    buf: gl.createBuffer(),
  };
}

function buildCandleVerts(bars, barCount, W, H, scrollOffset, visibleBars) {
  const { startIdx, endIdx } = getSliceRange(barCount, scrollOffset, visibleBars);
  const sliceLen = endIdx - startIdx;
  if (!sliceLen) return null;

  const { minPrice, maxPrice } = getSliceMinMax(bars, startIdx, endIdx);
  const priceRange = maxPrice - minPrice || 1;
  const barWidth = W / visibleBars;
  const toY = (price) => H - ((price - minPrice) / priceRange) * H * 0.9 - H * 0.05;

  // 12 verts per candle (2 quads = wick + body), 6 floats each (x,y,r,g,b,a)
  const verts = new Float32Array(sliceLen * 12 * 6);
  let vi = 0;
  const pv = (x, y, r, g, b, a) => {
    verts[vi++] = x; verts[vi++] = y;
    verts[vi++] = r; verts[vi++] = g; verts[vi++] = b; verts[vi++] = a;
  };

  for (let i = 0; i < sliceLen; i++) {
    const off = (startIdx + i) * 5;
    const open = bars[off], high = bars[off + 1], low = bars[off + 2], close = bars[off + 3];
    const isGreen = close >= open;
    const r = isGreen ? 0.149 : 0.937;
    const g = isGreen ? 0.651 : 0.325;
    const b = isGreen ? 0.604 : 0.314;

    const x = i * barWidth + barWidth * 0.1;
    const w = barWidth * 0.8;
    const cx = x + w / 2;
    const wickW = Math.max(1, barWidth * 0.1);
    const wy1 = toY(high), wy2 = toY(low);

    // Wick quad (2 triangles)
    pv(cx - wickW / 2, wy1, r, g, b, 1); pv(cx + wickW / 2, wy1, r, g, b, 1); pv(cx - wickW / 2, wy2, r, g, b, 1);
    pv(cx + wickW / 2, wy1, r, g, b, 1); pv(cx + wickW / 2, wy2, r, g, b, 1); pv(cx - wickW / 2, wy2, r, g, b, 1);

    // Body quad (2 triangles)
    const bt = toY(Math.max(open, close));
    const bb = Math.max(bt + 1, toY(Math.min(open, close)));
    pv(x, bt, r, g, b, 1); pv(x + w, bt, r, g, b, 1); pv(x, bb, r, g, b, 1);
    pv(x + w, bt, r, g, b, 1); pv(x + w, bb, r, g, b, 1); pv(x, bb, r, g, b, 1);
  }

  return { verts, vertCount: vi / 6 };
}

function renderWebGL(glCtx, bars, barCount, width, height, scrollOffset, visibleBars) {
  if (!glCtx) return;
  const { gl, posLoc, colLoc, resLoc, buf } = glCtx;
  const dpr = window.devicePixelRatio || 1;
  const W = width * dpr, H = height * dpr;

  gl.viewport(0, 0, W, H);
  gl.clearColor(0.031, 0.035, 0.039, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(resLoc, W, H);

  const result = buildCandleVerts(bars, barCount, W, H, scrollOffset, visibleBars);
  if (!result) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, result.verts.subarray(0, result.vertCount * 6), gl.DYNAMIC_DRAW);
  const stride = 24;
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(colLoc);
  gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, stride, 8);
  gl.drawArrays(gl.TRIANGLES, 0, result.vertCount);
}

// ─── WebGPU Render Pipeline ──────────────────────────────────────

const GPU_VERT = `
struct VertexInput { @location(0) position: vec2f, @location(1) color: vec4f };
struct VertexOutput { @builtin(position) position: vec4f, @location(0) color: vec4f };
@group(0) @binding(0) var<uniform> resolution: vec2f;
@vertex fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let clip = (input.position / resolution) * 2.0 - 1.0;
  out.position = vec4f(clip.x, -clip.y, 0.0, 1.0);
  out.color = input.color;
  return out;
}`;

const GPU_FRAG = `
@fragment fn main(@location(0) color: vec4f) -> @location(0) vec4f { return color; }`;

async function initWebGPU(canvas) {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;

    const device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      },
    });

    const ctx = canvas.getContext('webgpu');
    if (!ctx) { device.destroy(); return null; }

    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });

    const vertMod = device.createShaderModule({ code: GPU_VERT });
    const fragMod = device.createShaderModule({ code: GPU_FRAG });

    const uniformBuf = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bgl = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    });
    const bindGroup = device.createBindGroup({
      layout: bgl, entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: {
        module: vertMod, entryPoint: 'main',
        buffers: [{
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x4' },
          ],
        }],
      },
      fragment: { module: fragMod, entryPoint: 'main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const info = adapter.info || {};
    return {
      device, ctx, pipeline, uniformBuf, bindGroup, format,
      adapterInfo: {
        vendor: info.vendor || 'Unknown',
        architecture: info.architecture || '',
        device: info.device || info.description || 'WebGPU',
        maxBuffer: adapter.limits.maxBufferSize,
      },
    };
  } catch (err) {
    console.warn('[Speedtest] WebGPU init failed:', err);
    return null;
  }
}

function renderWebGPU(gpuCtx, bars, barCount, width, height, scrollOffset, visibleBars) {
  if (!gpuCtx) return;
  const { device, ctx, pipeline, uniformBuf, bindGroup } = gpuCtx;
  const dpr = window.devicePixelRatio || 1;
  const W = width * dpr, H = height * dpr;

  device.queue.writeBuffer(uniformBuf, 0, new Float32Array([W, H]));

  const result = buildCandleVerts(bars, barCount, W, H, scrollOffset, visibleBars);
  if (!result) return;

  const vertBuf = device.createBuffer({
    size: result.vertCount * 24,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertBuf, 0, result.verts.subarray(0, result.vertCount * 6));

  const tex = ctx.getCurrentTexture();
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: tex.createView(),
      clearValue: { r: 0.031, g: 0.035, b: 0.039, a: 1 },
      loadOp: 'clear', storeOp: 'store',
    }],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, vertBuf);
  pass.draw(result.vertCount);
  pass.end();
  device.queue.submit([enc.finish()]);
  vertBuf.destroy();
}

// ─── Renderer Config ─────────────────────────────────────────────

const RENDERERS = [
  { id: 'webgpu', label: 'WebGPU', icon: '🚀', color: '#22d3ee', desc: 'GPU-native rendering' },
  { id: 'webgl', label: 'WebGL', icon: '🔷', color: '#a78bfa', desc: 'Hardware-accelerated fallback' },
  { id: 'canvas2d', label: 'Canvas2D', icon: '🎨', color: '#f59e0b', desc: 'Software baseline' },
];

const BAR_COUNTS = [10_000, 50_000, 100_000, 500_000, 1_000_000];

// ─── Main Component ─────────────────────────────────────────────

export default function SpeedtestPage() {
  // One ref per renderer canvas
  const canvas2dRef = useRef(null);
  const canvasGLRef = useRef(null);
  const canvasGPURef = useRef(null);
  const animFrameRef = useRef(null);
  const barsRef = useRef(null);
  const barCountRef = useRef(0);
  const glCtxRef = useRef(null);
  const gpuCtxRef = useRef(null);

  const [barCount, setBarCount] = useState(100_000);
  const [renderer, setRenderer] = useState('canvas2d'); // safe default
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [visibleBars, setVisibleBars] = useState(200);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [genTime, setGenTime] = useState(null);

  const { fps, avgFrameTime, p95FrameTime, p1FrameTime, tick, reset: resetFps } = useFpsCounter();

  // Detect GPU capabilities
  useEffect(() => {
    let info = { renderer: 'Unknown', vendor: 'Unknown', webgpu: false };
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      setWebglAvailable(true);
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        info.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        info.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      }
    }
    if (navigator.gpu) {
      navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).then((adapter) => {
        if (adapter) {
          const ai = adapter.info || {};
          info.webgpu = true;
          info.webgpuDevice = ai.device || ai.description || 'Available';
          info.maxBuffer = adapter.limits.maxBufferSize;
          setWebgpuAvailable(true);
          setRenderer('webgpu'); // upgrade to best available
        }
        setGpuInfo(info);
      }).catch(() => setGpuInfo(info));
    } else {
      setGpuInfo(info);
    }
  }, []);

  // Size canvases
  useEffect(() => {
    [canvas2dRef, canvasGLRef, canvasGPURef].forEach((ref) => {
      const canvas = ref.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    });
  }, []);

  // Init WebGL
  useEffect(() => {
    if (canvasGLRef.current && !glCtxRef.current) {
      glCtxRef.current = initWebGL(canvasGLRef.current);
    }
  }, []);

  // Init WebGPU
  useEffect(() => {
    if (canvasGPURef.current && !gpuCtxRef.current && navigator.gpu) {
      initWebGPU(canvasGPURef.current).then((ctx) => {
        gpuCtxRef.current = ctx;
      });
    }
    return () => {
      if (gpuCtxRef.current?.device) {
        gpuCtxRef.current.device.destroy();
        gpuCtxRef.current = null;
      }
    };
  }, []);

  // Generate data
  const handleGenerate = useCallback(() => {
    setGenerating(true);
    stopBenchmark();
    setTimeout(() => {
      const t0 = performance.now();
      barsRef.current = generateBars(barCount);
      barCountRef.current = barCount;
      setGenTime((performance.now() - t0).toFixed(0));
      setScrollOffset(0);
      setGenerating(false);
    }, 50);
  }, [barCount]);

  // Scroll
  useEffect(() => {
    const activeCanvas =
      renderer === 'webgpu' ? canvasGPURef.current :
        renderer === 'webgl' ? canvasGLRef.current :
          canvas2dRef.current;
    if (!activeCanvas) return;
    const handler = (e) => {
      e.preventDefault();
      setScrollOffset((s) => {
        if (!barsRef.current) return s;
        return Math.max(0, Math.min(barCountRef.current - visibleBars, s + Math.sign(e.deltaY) * 5));
      });
    };
    activeCanvas.addEventListener('wheel', handler, { passive: false });
    return () => activeCanvas.removeEventListener('wheel', handler);
  }, [visibleBars, renderer]);

  // Benchmark loop
  const startBenchmark = useCallback(() => {
    if (!barsRef.current) return;
    setRunning(true);
    resetFps();
    const dpr = window.devicePixelRatio || 1;
    const bc = barCountRef.current;
    let offset = 0;

    const getCanvas = () =>
      renderer === 'webgpu' ? canvasGPURef.current :
        renderer === 'webgl' ? canvasGLRef.current :
          canvas2dRef.current;

    const canvas = getCanvas();
    if (!canvas) return;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    let ctx2d = renderer === 'canvas2d' ? canvas.getContext('2d') : null;

    const loop = () => {
      offset = (offset + 3) % Math.max(1, bc - visibleBars);
      if (renderer === 'webgpu') {
        renderWebGPU(gpuCtxRef.current, barsRef.current, bc, width, height, offset, visibleBars);
      } else if (renderer === 'webgl') {
        renderWebGL(glCtxRef.current, barsRef.current, bc, width, height, offset, visibleBars);
      } else if (ctx2d) {
        renderCanvas2D(ctx2d, barsRef.current, bc, width, height, offset, visibleBars);
      }
      tick();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [visibleBars, tick, renderer, resetFps]);

  const stopBenchmark = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    setRunning(false);
  }, []);

  // Cleanup & stop on renderer change
  useEffect(() => () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); }, []);
  useEffect(() => { stopBenchmark(); }, [renderer, stopBenchmark]);

  const fpsColor = fps >= 55 ? '#26a69a' : fps >= 30 ? '#f59e0b' : '#ef5350';
  const activeRenderer = RENDERERS.find(r => r.id === renderer);
  const memEst = barsRef.current ? ((barsRef.current.byteLength / 1024 / 1024).toFixed(1) + ' MB') : '—';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      background: C.bg, color: C.t1, fontFamily: F, overflow: 'hidden',
    }}>
      {/* ─── Header ───────────────────────────────────── */}
      <div style={{
        padding: '20px 28px', borderBottom: `1px solid ${C.bd}`,
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #22d3ee, #a78bfa, #f59e0b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            ⚡ charEdge Speed Test
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.t3 }}>
            Triple-renderer benchmark · WebGPU · WebGL · Canvas2D · up to 1M candles
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {gpuInfo && (
          <div style={{
            fontSize: 11, color: C.t3, textAlign: 'right',
            background: GLASS.subtle, backdropFilter: GLASS.blurSm,
            padding: '8px 14px', borderRadius: 10,
            border: GLASS.border, boxShadow: DEPTH[1],
          }}>
            <div style={{ fontWeight: 700, color: gpuInfo.webgpu ? '#22d3ee' : '#f59e0b', fontSize: 12 }}>
              {gpuInfo.webgpu ? '🟢 WebGPU Ready' : '🟡 WebGL Only'}
            </div>
            <div style={{ marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gpuInfo.renderer || 'Unknown GPU'}
            </div>
            {gpuInfo.maxBuffer && (
              <div style={{ marginTop: 1, fontSize: 10 }}>
                Buffer: {(gpuInfo.maxBuffer / 1024 / 1024 / 1024).toFixed(1)} GB
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Controls ─────────────────────────────────── */}
      <div style={{
        padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px solid ${C.bd}`, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: C.t3, fontWeight: 600, marginRight: 4 }}>Renderer:</span>
        {RENDERERS.map((r) => {
          const disabled = (r.id === 'webgpu' && !webgpuAvailable) || (r.id === 'webgl' && !webglAvailable);
          const active = renderer === r.id;
          return (
            <button key={r.id} onClick={() => !disabled && setRenderer(r.id)} disabled={disabled}
              title={disabled ? `${r.label} not available` : r.desc}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: M,
                transition: 'all 0.2s',
                background: active ? r.color + '18' : 'transparent',
                color: disabled ? C.t3 + '60' : active ? r.color : C.t3,
                border: active ? `1px solid ${r.color}40` : `1px solid ${C.bd}`,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {r.icon} {r.label}
            </button>
          );
        })}

        <div style={{ width: 1, height: 20, background: C.bd, margin: '0 8px' }} />

        <span style={{ fontSize: 12, color: C.t3, fontWeight: 600 }}>Bars:</span>
        {BAR_COUNTS.map((n) => (
          <button key={n} onClick={() => { setBarCount(n); stopBenchmark(); }}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: M, transition: 'all 0.15s',
              background: barCount === n ? C.b + '20' : 'transparent',
              color: barCount === n ? C.b : C.t3,
              border: barCount === n ? `1px solid ${C.b}40` : `1px solid ${C.bd}`,
            }}
          >
            {n >= 1_000_000 ? (n / 1_000_000) + 'M' : (n / 1000) + 'K'}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: C.bd, margin: '0 4px' }} />

        <button onClick={handleGenerate} disabled={generating}
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: generating ? 'wait' : 'pointer', fontFamily: M,
            background: generating ? C.bd : `linear-gradient(135deg, ${C.b}, #ef4444)`,
            color: '#fff', border: 'none',
          }}
        >
          {generating ? '⏳ Generating...' : '📊 Generate'}
        </button>

        <button onClick={running ? stopBenchmark : startBenchmark}
          disabled={!barsRef.current || generating}
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: (!barsRef.current || generating) ? 'not-allowed' : 'pointer',
            fontFamily: M, border: 'none',
            background: running
              ? 'linear-gradient(135deg, #ef5350, #e53935)'
              : 'linear-gradient(135deg, #26a69a, #2dd4a0)',
            color: '#fff', opacity: (!barsRef.current || generating) ? 0.4 : 1,
          }}
        >
          {running ? '⏹ Stop' : '▶ Benchmark'}
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 11, color: C.t3 }}>Visible: {visibleBars}</span>
        <input type="range" min="50" max="2000" step="50" value={visibleBars}
          onChange={(e) => setVisibleBars(Number(e.target.value))}
          style={{ width: 100, accentColor: activeRenderer?.color || C.b }}
        />
      </div>

      {/* ─── Stats Bar ────────────────────────────────── */}
      <div style={{
        padding: '10px 28px', display: 'flex', gap: 24, flexWrap: 'wrap',
        borderBottom: `1px solid ${C.bd}`, flexShrink: 0,
        background: GLASS.subtle, backdropFilter: GLASS.blurSm,
      }}>
        {[
          { label: 'FPS', value: fps || '—', color: fpsColor, big: true },
          { label: 'Avg Frame', value: avgFrameTime ? avgFrameTime + 'ms' : '—', color: C.t2 },
          { label: 'P95 Frame', value: p95FrameTime ? p95FrameTime + 'ms' : '—', color: C.t2 },
          { label: 'P1 (Best)', value: p1FrameTime ? p1FrameTime + 'ms' : '—', color: C.t2 },
          { label: 'Total Bars', value: barsRef.current ? barCountRef.current.toLocaleString() : '0', color: C.b },
          { label: 'Renderer', value: activeRenderer?.label || '—', color: activeRenderer?.color || C.t2 },
          { label: 'Memory', value: memEst, color: C.t2 },
          ...(genTime ? [{ label: 'Gen Time', value: genTime + 'ms', color: C.p }] : []),
        ].map(({ label, value, color, big }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
            <span style={{ fontSize: 10, color: C.t3, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
              {label}
            </span>
            <span style={{ fontSize: big ? 24 : 18, fontWeight: 800, color, fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Chart Canvas Area ─────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Three canvases, only the active one is visible */}
        <canvas ref={canvas2dRef} style={{
          position: 'absolute', inset: 0, cursor: 'crosshair',
          display: renderer === 'canvas2d' ? 'block' : 'none',
        }} />
        <canvas ref={canvasGLRef} style={{
          position: 'absolute', inset: 0, cursor: 'crosshair',
          display: renderer === 'webgl' ? 'block' : 'none',
        }} />
        <canvas ref={canvasGPURef} style={{
          position: 'absolute', inset: 0, cursor: 'crosshair',
          display: renderer === 'webgpu' ? 'block' : 'none',
        }} />

        {!barsRef.current && !generating && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16, zIndex: 1,
          }}>
            <div style={{ fontSize: 56, opacity: 0.15 }}>⚡</div>
            <div style={{ fontSize: 14, color: C.t3, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
              Select a <b style={{ color: C.t2 }}>renderer</b> and <b style={{ color: C.t2 }}>bar count</b>, then
              click <b style={{ color: C.b }}>Generate</b> and <b style={{ color: '#26a69a' }}>Benchmark</b>.
            </div>
            <div style={{
              fontSize: 11, color: C.t3, marginTop: 8, padding: '6px 12px',
              background: C.sf, borderRadius: 6, border: `1px solid ${C.bd}`,
            }}>
              💡 Try 1M candles with WebGPU for maximum stress
            </div>
          </div>
        )}
        {generating && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 2,
          }}>
            <span style={{ fontSize: 14, color: C.t2 }}>
              ⏳ Generating {barCount.toLocaleString()} candles...
            </span>
          </div>
        )}
      </div>

      {/* ─── Footer ────────────────────────────────────── */}
      <div style={{
        padding: '8px 28px', borderTop: `1px solid ${C.bd}`,
        fontSize: 11, color: C.t3, display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600 }}>charEdge Performance Suite</span>
        <span>•</span>
        <span>DPR: {(window.devicePixelRatio || 1).toFixed(1)}</span>
        <span>•</span>
        <span>Scroll: navigate · {activeRenderer?.label} active</span>
        <div style={{ flex: 1 }} />
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 10,
          background: webgpuAvailable ? '#22d3ee15' : '#f59e0b15',
          color: webgpuAvailable ? '#22d3ee' : '#f59e0b',
        }}>
          {webgpuAvailable ? 'WebGPU ✓' : 'WebGPU ✗'}
        </span>
      </div>
    </div>
  );
}
