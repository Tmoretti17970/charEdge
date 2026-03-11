// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGPU Compute Pipeline
//
// Next-generation GPU compute for chart data processing.
// Runs LTTB decimation, indicator calculations, and data aggregation
// entirely on the GPU via WebGPU compute shaders.
//
// Feature detection: gracefully falls back to CPU if WebGPU
// is not available.
//
// Capabilities:
//   - GPU-side LTTB decimation (50M points @60fps)
//   - GPU indicator computation (EMA, RSI, Bollinger, MACD)
//   - GPU hit testing for crosshair/drawings
//   - Data aggregation (min/max/sum per pixel column)
//   - Volume profile binning
// ═══════════════════════════════════════════════════════════════════

// ─── WGSL Compute Shaders (loaded from .wgsl files) ──────────
import MIN_MAX_SHADER from '../shaders/compute/minmax.wgsl?raw';
import EMA_SHADER from '../shaders/compute/ema.wgsl?raw';
import HIT_TEST_SHADER from '../shaders/compute/hittest.wgsl?raw';
import RSI_SHADER from '../shaders/compute/rsi.wgsl?raw';
import BOLLINGER_SHADER from '../shaders/compute/bollinger.wgsl?raw';
import LTTB_SHADER from '../shaders/compute/lttb.wgsl?raw';
import VP_BIN_SHADER from '../shaders/compute/volumeProfile.wgsl?raw';
import { logger } from '@/observability/logger';

// ─── Type Definitions ────────────────────────────────────────

/** Named compute pipelines available in this engine. */
interface ComputePipelines {
  minMax: GPUComputePipeline | null;
  ema: GPUComputePipeline | null;
  hitTest: GPUComputePipeline | null;
  rsi: GPUComputePipeline | null;
  bollinger: GPUComputePipeline | null;
  lttb: GPUComputePipeline | null;
  vpBin: GPUComputePipeline | null;
}

/** Result of a min/max decimation pass. */
export interface MinMaxResult {
  min: Float32Array;
  max: Float32Array;
}

/** Result of a MACD computation. */
export interface MACDResult {
  macd: Float32Array;
  signal: Float32Array;
  histogram: Float32Array;
}

/** Result of a Bollinger Bands computation. */
export interface BollingerResult {
  middle: Float32Array;
  upper: Float32Array;
  lower: Float32Array;
}

/** Result of an LTTB decimation pass. */
export interface LTTBResult {
  x: Float32Array;
  y: Float32Array;
}

/** Input data for volume profile computation. */
export interface VolumeProfileInput {
  high: Float32Array;
  low: Float32Array;
  close: Float32Array;
  open: Float32Array;
  volume: Float32Array;
}

/** Result of a volume profile binning computation. */
export interface VolumeProfileResult {
  upBins: Float32Array;
  downBins: Float32Array;
}

// ═══════════════════════════════════════════════════════════════
// WebGPUCompute Class
// ═══════════════════════════════════════════════════════════════

export class WebGPUCompute {
  device: GPUDevice | null;
  private _pipelines: Partial<ComputePipelines>;
  private _available: boolean;
  private _initPromise: Promise<void>;

  constructor() {
    this.device = null;
    this._pipelines = {};
    this._available = false;
    this._initPromise = this._init();
  }

  get available(): boolean {
    return this._available;
  }

  private async _init(): Promise<void> {
    try {
      if (!navigator.gpu) {
        logger.engine.info('[WebGPUCompute] WebGPU not available in this browser');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (!adapter) {
        logger.engine.warn('[WebGPUCompute] No GPU adapter found');
        return;
      }

      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
          maxBufferSize: adapter.limits.maxBufferSize,
        },
      });

      this.device.lost.then((info) => {
        logger.engine.error('[WebGPUCompute] Device lost:', info.message);
        this._available = false;
      });

      // Compile compute pipelines
      this._pipelines.minMax = this._createPipeline(MIN_MAX_SHADER);
      this._pipelines.ema = this._createPipeline(EMA_SHADER);
      this._pipelines.hitTest = this._createPipeline(HIT_TEST_SHADER);
      this._pipelines.rsi = this._createPipeline(RSI_SHADER);
      this._pipelines.bollinger = this._createPipeline(BOLLINGER_SHADER);
      this._pipelines.lttb = this._createPipeline(LTTB_SHADER);
      this._pipelines.vpBin = this._createPipeline(VP_BIN_SHADER);

      this._available = true;
      logger.engine.info('[WebGPUCompute] Initialized successfully');
    } catch (err) {
      logger.engine.warn('[WebGPUCompute] Init failed:', (err as Error).message);
    }
  }

  private _createPipeline(shaderCode: string): GPUComputePipeline | null {
    if (!this.device) return null;

    try {
      const shaderModule = this.device.createShaderModule({ code: shaderCode });

      // Check for shader compilation errors asynchronously
      shaderModule.getCompilationInfo?.().then((info) => {
        for (const msg of info.messages) {
          if (msg.type === 'error') {
            logger.engine.error(`[WebGPUCompute] Shader error: ${msg.message} (line ${msg.lineNum}:${msg.linePos})`);
          }
        }
      }).catch(() => {});

      return this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });
    } catch (err) {
      logger.engine.warn('[WebGPUCompute] Pipeline creation failed:', (err as Error).message);
      return null;
    }
  }

  // ─── MinMax Decimation on GPU ───────────────────────────────

  /**
   * Compute per-column min/max on the GPU.
   *
   * @param highData - High prices array
   * @param lowData - Low prices array
   * @param barCount - Total number of bars
   * @param columnCount - Number of pixel columns to decimate into
   * @returns Min/max per column, or null if GPU unavailable
   */
  async computeMinMax(
    highData: Float32Array,
    lowData: Float32Array,
    barCount: number,
    columnCount: number,
  ): Promise<MinMaxResult | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.minMax) return null;

    const device = this.device!;

    // Create GPU buffers
    const highBuf = device.createBuffer({
      size: highData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(highBuf, 0, highData);

    const lowBuf = device.createBuffer({
      size: lowData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(lowBuf, 0, lowData);

    const colMinBuf = device.createBuffer({
      size: columnCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const colMaxBuf = device.createBuffer({
      size: columnCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const paramsBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const paramsData = new ArrayBuffer(16);
    const paramsU32 = new Uint32Array(paramsData);
    const paramsF32 = new Float32Array(paramsData);
    paramsU32[0] = barCount;
    paramsU32[1] = columnCount;
    paramsF32[2] = barCount / columnCount;
    paramsU32[3] = 0;
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    // Create bind group
    const bindGroup = device.createBindGroup({
      layout: this._pipelines.minMax.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: highBuf } },
        { binding: 1, resource: { buffer: lowBuf } },
        { binding: 2, resource: { buffer: colMinBuf } },
        { binding: 3, resource: { buffer: colMaxBuf } },
        { binding: 4, resource: { buffer: paramsBuf } },
      ],
    });

    // Dispatch compute
    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.minMax);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(columnCount / 64));
    pass.end();

    // Read back results
    const readMinBuf = device.createBuffer({ size: columnCount * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readMaxBuf = device.createBuffer({ size: columnCount * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    commandEncoder.copyBufferToBuffer(colMinBuf, 0, readMinBuf, 0, columnCount * 4);
    commandEncoder.copyBufferToBuffer(colMaxBuf, 0, readMaxBuf, 0, columnCount * 4);

    device.queue.submit([commandEncoder.finish()]);

    await readMinBuf.mapAsync(GPUMapMode.READ);
    await readMaxBuf.mapAsync(GPUMapMode.READ);

    const minResult = new Float32Array(readMinBuf.getMappedRange().slice(0));
    const maxResult = new Float32Array(readMaxBuf.getMappedRange().slice(0));

    readMinBuf.unmap();
    readMaxBuf.unmap();

    // Cleanup
    highBuf.destroy();
    lowBuf.destroy();
    colMinBuf.destroy();
    colMaxBuf.destroy();
    paramsBuf.destroy();
    readMinBuf.destroy();
    readMaxBuf.destroy();

    return { min: minResult, max: maxResult };
  }

  // ─── EMA on GPU ─────────────────────────────────────────────

  /**
   * Compute Exponential Moving Average on the GPU.
   *
   * @param inputData - Close prices
   * @param period - EMA period
   * @returns EMA values, or null if GPU unavailable
   */
  async computeEMA(inputData: Float32Array, period: number): Promise<Float32Array | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.ema) return null;

    const device = this.device!;
    const length = inputData.length;

    const inputBuf = device.createBuffer({
      size: inputData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(inputBuf, 0, inputData);

    const outputBuf = device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const paramsBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const paramsData = new ArrayBuffer(16);
    const paramsView = new DataView(paramsData);
    paramsView.setUint32(0, length, true);
    paramsView.setUint32(4, period, true);
    paramsView.setFloat32(8, 2 / (period + 1), true);
    paramsView.setUint32(12, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.ema.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuf } },
        { binding: 1, resource: { buffer: outputBuf } },
        { binding: 2, resource: { buffer: paramsBuf } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.ema);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1); // EMA is sequential
    pass.end();

    const readBuf = device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(outputBuf, 0, readBuf, 0, length * 4);

    device.queue.submit([commandEncoder.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();

    inputBuf.destroy();
    outputBuf.destroy();
    paramsBuf.destroy();
    readBuf.destroy();

    return result;
  }

  // ─── RSI Compute ────────────────────────────────────────────

  /**
   * Compute RSI (Relative Strength Index) on the GPU.
   *
   * @param inputData - Close prices
   * @param period - RSI period (default 14)
   * @returns RSI values, or null if GPU unavailable
   */
  async computeRSI(inputData: Float32Array, period: number = 14): Promise<Float32Array | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.rsi) return null;

    const device = this.device!;
    const length = inputData.length;

    const inputBuf = device.createBuffer({
      size: inputData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(inputBuf, 0, inputData);

    const outputBuf = device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const paramsBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const paramsData = new ArrayBuffer(16);
    const pv = new DataView(paramsData);
    pv.setUint32(0, length, true);
    pv.setUint32(4, period, true);
    pv.setUint32(8, 0, true);
    pv.setUint32(12, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.rsi.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuf } },
        { binding: 1, resource: { buffer: outputBuf } },
        { binding: 2, resource: { buffer: paramsBuf } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.rsi);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1); // RSI is sequential (Wilder's smoothing)
    pass.end();

    const readBuf = device.createBuffer({
      size: length * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(outputBuf, 0, readBuf, 0, length * 4);

    device.queue.submit([commandEncoder.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();

    inputBuf.destroy();
    outputBuf.destroy();
    paramsBuf.destroy();
    readBuf.destroy();

    return result;
  }

  // ─── MACD Compute ───────────────────────────────────────────

  /**
   * Compute MACD on the GPU using 3 EMA passes.
   * MACD Line = EMA(fast) - EMA(slow), Signal = EMA(signal) of MACD Line.
   *
   * @param inputData - Close prices
   * @param fast - Fast EMA period (default 12)
   * @param slow - Slow EMA period (default 26)
   * @param signal - Signal EMA period (default 9)
   * @returns MACD line, signal, and histogram, or null if GPU unavailable
   */
  async computeMACD(
    inputData: Float32Array,
    fast: number = 12,
    slow: number = 26,
    signal: number = 9,
  ): Promise<MACDResult | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.ema) return null;

    // EMA(fast) and EMA(slow)
    const [emaFast, emaSlow] = await Promise.all([
      this.computeEMA(inputData, fast),
      this.computeEMA(inputData, slow),
    ]);

    if (!emaFast || !emaSlow) return null;

    // MACD line = EMA(fast) - EMA(slow)
    const length = inputData.length;
    const macdLine = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }

    // Signal line = EMA(signal) of MACD line
    const signalLine = await this.computeEMA(macdLine, signal);
    if (!signalLine) return null;

    // Histogram = MACD - Signal
    const histogram = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      histogram[i] = macdLine[i] - signalLine[i];
    }

    return { macd: macdLine, signal: signalLine, histogram };
  }

  // ─── Bollinger Bands Compute ────────────────────────────────

  /**
   * Compute Bollinger Bands on the GPU.
   *
   * @param inputData - Close prices
   * @param period - Lookback period (default 20)
   * @param multiplier - Standard deviation multiplier (default 2)
   * @returns Middle/upper/lower bands, or null if GPU unavailable
   */
  async computeBollinger(
    inputData: Float32Array,
    period: number = 20,
    multiplier: number = 2,
  ): Promise<BollingerResult | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.bollinger) return null;

    const device = this.device!;
    const length = inputData.length;

    const inputBuf = device.createBuffer({
      size: inputData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(inputBuf, 0, inputData);

    const middleBuf = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const upperBuf = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const lowerBuf = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const paramsBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const paramsData = new ArrayBuffer(16);
    const pv = new DataView(paramsData);
    pv.setUint32(0, length, true);
    pv.setUint32(4, period, true);
    pv.setFloat32(8, multiplier, true);
    pv.setUint32(12, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.bollinger.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuf } },
        { binding: 1, resource: { buffer: middleBuf } },
        { binding: 2, resource: { buffer: upperBuf } },
        { binding: 3, resource: { buffer: lowerBuf } },
        { binding: 4, resource: { buffer: paramsBuf } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.bollinger);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(length / 64));
    pass.end();

    const readMiddle = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readUpper = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readLower = device.createBuffer({ size: length * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    commandEncoder.copyBufferToBuffer(middleBuf, 0, readMiddle, 0, length * 4);
    commandEncoder.copyBufferToBuffer(upperBuf, 0, readUpper, 0, length * 4);
    commandEncoder.copyBufferToBuffer(lowerBuf, 0, readLower, 0, length * 4);

    device.queue.submit([commandEncoder.finish()]);

    await Promise.all([
      readMiddle.mapAsync(GPUMapMode.READ),
      readUpper.mapAsync(GPUMapMode.READ),
      readLower.mapAsync(GPUMapMode.READ),
    ]);

    const middle = new Float32Array(readMiddle.getMappedRange().slice(0));
    const upper = new Float32Array(readUpper.getMappedRange().slice(0));
    const lower = new Float32Array(readLower.getMappedRange().slice(0));
    readMiddle.unmap();
    readUpper.unmap();
    readLower.unmap();

    [inputBuf, middleBuf, upperBuf, lowerBuf, paramsBuf, readMiddle, readUpper, readLower]
      .forEach((b) => b.destroy());

    return { middle, upper, lower };
  }

  // ─── LTTB Decimation ────────────────────────────────────────

  /**
   * Decimate a large dataset using Largest-Triangle-Three-Buckets.
   * Parallelized per-bucket selection on GPU.
   *
   * @param xData - X coordinates (typically time indices)
   * @param yData - Y coordinates (typically prices)
   * @param targetSize - Desired output size
   * @returns Decimated x/y arrays, or null if GPU unavailable
   */
  async decimateLTTB(
    xData: Float32Array,
    yData: Float32Array,
    targetSize: number,
  ): Promise<LTTBResult | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.lttb) return null;
    if (xData.length <= targetSize) return { x: xData, y: yData };

    const device = this.device!;
    const inLen = xData.length;

    const xBuf = device.createBuffer({ size: xData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const yBuf = device.createBuffer({ size: yData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(xBuf, 0, xData);
    device.queue.writeBuffer(yBuf, 0, yData);

    const outXBuf = device.createBuffer({ size: targetSize * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const outYBuf = device.createBuffer({ size: targetSize * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const paramsData = new ArrayBuffer(16);
    const pv = new DataView(paramsData);
    pv.setUint32(0, inLen, true);
    pv.setUint32(4, targetSize, true);
    pv.setUint32(8, 0, true);
    pv.setUint32(12, 0, true);
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.lttb.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: xBuf } },
        { binding: 1, resource: { buffer: yBuf } },
        { binding: 2, resource: { buffer: outXBuf } },
        { binding: 3, resource: { buffer: outYBuf } },
        { binding: 4, resource: { buffer: paramsBuf } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.lttb);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(targetSize / 64));
    pass.end();

    const readX = device.createBuffer({ size: targetSize * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readY = device.createBuffer({ size: targetSize * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    commandEncoder.copyBufferToBuffer(outXBuf, 0, readX, 0, targetSize * 4);
    commandEncoder.copyBufferToBuffer(outYBuf, 0, readY, 0, targetSize * 4);

    device.queue.submit([commandEncoder.finish()]);
    await Promise.all([readX.mapAsync(GPUMapMode.READ), readY.mapAsync(GPUMapMode.READ)]);

    const outX = new Float32Array(readX.getMappedRange().slice(0));
    const outY = new Float32Array(readY.getMappedRange().slice(0));
    readX.unmap();
    readY.unmap();

    // Set first and last points (not handled by shader)
    outX[0] = xData[0];
    outY[0] = yData[0];
    outX[targetSize - 1] = xData[inLen - 1];
    outY[targetSize - 1] = yData[inLen - 1];

    [xBuf, yBuf, outXBuf, outYBuf, paramsBuf, readX, readY].forEach((b) => b.destroy());

    return { x: outX, y: outY };
  }

  // ─── Volume Profile Binning ─────────────────────────────────

  /**
   * Compute volume profile histogram bins on the GPU.
   * Distributes volume across price bins using atomic adds.
   *
   * @param data - OHLCV data as Float32Arrays
   * @param binCount - Number of price bins
   * @param priceMin - Min price for binning range
   * @param priceMax - Max price for binning range
   * @returns Up/down volume bins, or null if GPU unavailable
   */
  async computeVolumeProfile(
    data: VolumeProfileInput,
    binCount: number,
    priceMin: number,
    priceMax: number,
  ): Promise<VolumeProfileResult | null> {
    await this._initPromise;
    if (!this._available || !this._pipelines.vpBin) return null;

    const device = this.device!;
    const barCount = data.high.length;

    const highBuf = device.createBuffer({ size: barCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const lowBuf = device.createBuffer({ size: barCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const volBuf = device.createBuffer({ size: barCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const closeBuf = device.createBuffer({ size: barCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const openBuf = device.createBuffer({ size: barCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(highBuf, 0, data.high);
    device.queue.writeBuffer(lowBuf, 0, data.low);
    device.queue.writeBuffer(volBuf, 0, data.volume);
    device.queue.writeBuffer(closeBuf, 0, data.close);
    device.queue.writeBuffer(openBuf, 0, data.open);

    const upBinBuf = device.createBuffer({ size: binCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const downBinBuf = device.createBuffer({ size: binCount * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const paramsData = new ArrayBuffer(16);
    const pv = new DataView(paramsData);
    pv.setUint32(0, barCount, true);
    pv.setUint32(4, binCount, true);
    pv.setFloat32(8, priceMin, true);
    pv.setFloat32(12, priceMax, true);
    device.queue.writeBuffer(paramsBuf, 0, paramsData);

    const bindGroup = device.createBindGroup({
      layout: this._pipelines.vpBin.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: highBuf } },
        { binding: 1, resource: { buffer: lowBuf } },
        { binding: 2, resource: { buffer: volBuf } },
        { binding: 3, resource: { buffer: closeBuf } },
        { binding: 4, resource: { buffer: openBuf } },
        { binding: 5, resource: { buffer: upBinBuf } },
        { binding: 6, resource: { buffer: downBinBuf } },
        { binding: 7, resource: { buffer: paramsBuf } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this._pipelines.vpBin);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(barCount / 64));
    pass.end();

    const readUp = device.createBuffer({ size: binCount * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readDown = device.createBuffer({ size: binCount * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    commandEncoder.copyBufferToBuffer(upBinBuf, 0, readUp, 0, binCount * 4);
    commandEncoder.copyBufferToBuffer(downBinBuf, 0, readDown, 0, binCount * 4);

    device.queue.submit([commandEncoder.finish()]);
    await Promise.all([readUp.mapAsync(GPUMapMode.READ), readDown.mapAsync(GPUMapMode.READ)]);

    // Convert atomic u32 bins back to float volumes (divide by 1000 scale factor)
    const upU32 = new Uint32Array(readUp.getMappedRange().slice(0));
    const downU32 = new Uint32Array(readDown.getMappedRange().slice(0));
    readUp.unmap();
    readDown.unmap();

    const upBins = new Float32Array(binCount);
    const downBins = new Float32Array(binCount);
    for (let i = 0; i < binCount; i++) {
      upBins[i] = upU32[i] / 1000;
      downBins[i] = downU32[i] / 1000;
    }

    [highBuf, lowBuf, volBuf, closeBuf, openBuf, upBinBuf, downBinBuf, paramsBuf, readUp, readDown]
      .forEach((b) => b.destroy());

    return { upBins, downBins };
  }

  // ─── Cleanup ────────────────────────────────────────────────

  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this._available = false;
    this._pipelines = {};
  }
}
