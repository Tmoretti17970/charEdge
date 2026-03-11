import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Compute Worker Pool
//
// Dynamic Web Worker pool with priority scheduling, work-stealing,
// warm workers, task affinity, and adaptive pool sizing.
//
// v17 enhancements:
//   • Work-stealing: idle workers pull tasks from other workers' local queues
//   • Warm workers: pre-initialized, kept alive between tasks (no teardown)
//   • Task affinity: same task types routed to same worker (cache locality)
//   • Adaptive sizing: pool grows/shrinks based on queue depth + CPU load
//   • Priority queue: critical > high > normal > low
//   • TypedArray transfers via Transferable for zero-copy
//   • Timeout handling + progress reporting
//
// Usage:
//   import { computePool } from './ComputeWorkerPool.js';
//   const result = await computePool.submit({
//     type: 'indicator',
//     indicator: 'ichimoku',
//     data: bars,
//     priority: 'critical',
//   });
// ═══════════════════════════════════════════════════════════════════

// ─── Priority Levels ───────────────────────────────────────────

const PRIORITY = {
  critical: 0,  // Visible chart computations
  high: 1,      // Open panels
  normal: 2,    // Background tasks
  low: 3,       // Prefetch / non-urgent
};

const DEFAULT_TIMEOUT_MS = 30000;      // 30 second task timeout
const MIN_WORKERS = 1;
const MAX_WORKERS = 8;

// Adaptive sizing constants
const QUEUE_GROW_THRESHOLD = 5;        // Grow pool if queue > 5 pending tasks
const QUEUE_SHRINK_THRESHOLD = 0;      // Shrink if queue stays empty
const SHRINK_IDLE_MS = 30000;          // Shrink after 30s of zero queue depth
const ADAPTIVE_CHECK_MS = 5000;        // Check queue depth every 5s

// ─── Pending Task ──────────────────────────────────────────────

class PendingTask {
  constructor(task, resolve, reject) {
    this.id = ++PendingTask._idCounter;
    this.task = task;
    this.priority = PRIORITY[task.priority] ?? PRIORITY.normal;
    this.resolve = resolve;
    this.reject = reject;
    this.submitted = Date.now();
    this.timeout = task.timeout || DEFAULT_TIMEOUT_MS;
    this.onProgress = task.onProgress || null;
    this.taskType = task.type || 'custom';  // For task affinity
  }
}
PendingTask._idCounter = 0;

// ─── Worker Wrapper ────────────────────────────────────────────

class PoolWorker {
  constructor(id, pool) {
    this.id = id;
    this.pool = pool;
    this.busy = false;
    this.currentTask = null;
    this.tasksCompleted = 0;
    this.worker = null;

    // Task affinity tracking — what task types this worker has run
    this.affinityScores = new Map();   // taskType → count
    this.specialization = null;        // Most common task type

    // Warm state tracking
    this.lastActiveTime = Date.now();
    this.warm = true;

    this._init();
  }

  _init() {
    try {
      const workerUrl = new URL('./ComputeWorker.js', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (event) => {
        const msg = event.data;

        if (msg.type === 'result') {
          this._completeTask(msg.data, null);
        } else if (msg.type === 'error') {
          this._completeTask(null, new Error(msg.error || 'Worker error'));
        } else if (msg.type === 'progress' && this.currentTask?.onProgress) {
          this.currentTask.onProgress(msg.progress);
        }
      };

      this.worker.onerror = (err) => {
        this._completeTask(null, new Error(err.message || 'Worker crashed'));
      };
    } catch (err) {
      logger.worker.warn(`[ComputePool] Worker ${this.id} init failed:`, err.message);
    }
  }

  execute(pendingTask) {
    if (!this.worker) {
      pendingTask.reject(new Error('Worker not available'));
      return;
    }

    this.busy = true;
    this.currentTask = pendingTask;
    this.lastActiveTime = Date.now();

    // Track task affinity
    const count = (this.affinityScores.get(pendingTask.taskType) || 0) + 1;
    this.affinityScores.set(pendingTask.taskType, count);
    // Update specialization to the most-run task type
    if (!this.specialization || count > (this.affinityScores.get(this.specialization) || 0)) {
      this.specialization = pendingTask.taskType;
    }

    // Set timeout
    this._timer = setTimeout(() => {
      this._completeTask(null, new Error(`Task timed out after ${pendingTask.timeout}ms`));
    }, pendingTask.timeout);

    // Build transferable list for TypedArrays
    const transferables = [];
    const taskData = { ...pendingTask.task, taskId: pendingTask.id };

    // If data is a TypedArray, transfer it (zero-copy)
    if (taskData.data instanceof ArrayBuffer) {
      transferables.push(taskData.data);
    } else if (ArrayBuffer.isView(taskData.data)) {
      transferables.push(taskData.data.buffer);
    }

    try {
      this.worker.postMessage(taskData, transferables);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Fallback: structured clone (slower but works for any data)
      this.worker.postMessage(taskData);
    }
  }

  _completeTask(result, error) {
    clearTimeout(this._timer);
    const task = this.currentTask;
    this.currentTask = null;
    this.busy = false;
    this.lastActiveTime = Date.now();

    if (task) {
      this.tasksCompleted++;
      if (error) task.reject(error);
      else task.resolve(result);
    }

    // Work-stealing: try to pull next task from pool
    this.pool._scheduleNext(this);
  }

  /** Affinity score: how well this worker matches a task type */
  getAffinityFor(taskType) {
    return this.affinityScores.get(taskType) || 0;
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.warm = false;
    if (this.currentTask) {
      this.currentTask.reject(new Error('Worker terminated'));
      this.currentTask = null;
    }
  }
}

// ─── Compute Worker Pool ───────────────────────────────────────

class _ComputeWorkerPool {
  constructor() {
    this._workers = [];
    this._queue = [];       // PendingTask[] — priority-sorted
    this._poolSize = 0;
    this._totalSubmitted = 0;
    this._totalCompleted = 0;
    this._fallbackMode = false;

    // Adaptive sizing
    this._minPoolSize = MIN_WORKERS;
    this._maxPoolSize = MAX_WORKERS;
    this._lastShrinkCheck = Date.now();
    this._adaptiveTimer = null;

    this._init();
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Submit a compute task to the pool.
   *
   * @param {Object} task
   * @param {string} task.type - 'indicator', 'volumeProfile', 'correlation', 'backtest', 'export', 'custom'
   * @param {string} [task.priority='normal'] - 'critical', 'high', 'normal', 'low'
   * @param {*} task.data - Input data (can be TypedArray for zero-copy transfer)
   * @param {Object} [task.params] - Additional parameters
   * @param {number} [task.timeout] - Task timeout in ms
   * @param {Function} [task.onProgress] - Progress callback
   * @returns {Promise<*>} Task result
   */
  submit(task) {
    this._totalSubmitted++;

    // Fallback to main-thread computation if Workers unavailable
    if (this._fallbackMode) {
      return this._runOnMainThread(task);
    }

    return new Promise((resolve, reject) => {
      const pending = new PendingTask(task, resolve, reject);
      this._enqueue(pending);
      this._scheduleAll();
    });
  }

  /**
   * Submit multiple tasks as a batch.
   * Returns when all complete.
   *
   * @param {Array<Object>} tasks
   * @returns {Promise<Array<*>>}
   */
  submitBatch(tasks) {
    return Promise.all(tasks.map(t => this.submit(t)));
  }

  /**
   * Get pool statistics.
   */
  getStats() {
    const idleWorkers = this._workers.filter(w => !w.busy);
    return {
      poolSize: this._poolSize,
      busyWorkers: this._workers.filter(w => w.busy).length,
      idleWorkers: idleWorkers.length,
      queueLength: this._queue.length,
      totalSubmitted: this._totalSubmitted,
      totalCompleted: this._totalCompleted,
      fallbackMode: this._fallbackMode,
      workerStats: this._workers.map(w => ({
        id: w.id,
        busy: w.busy,
        tasksCompleted: w.tasksCompleted,
        specialization: w.specialization,
        warm: w.warm,
        idleMs: w.busy ? 0 : Date.now() - w.lastActiveTime,
      })),
    };
  }

  /**
   * Resize the pool (e.g., when user changes settings).
   *
   * @param {number} size
   */
  resize(size) {
    const newSize = Math.max(this._minPoolSize, Math.min(this._maxPoolSize, size));

    // Shrink: terminate excess idle workers (prefer least specialized)
    while (this._workers.length > newSize) {
      // Find least busy, least specialized worker to terminate
      const idleWorkers = this._workers.filter(w => !w.busy);
      if (idleWorkers.length === 0) break;  // Can't shrink while all busy
      const victim = idleWorkers.sort((a, b) => a.tasksCompleted - b.tasksCompleted)[0];
      victim.terminate();
      this._workers = this._workers.filter(w => w !== victim);
    }

    // Grow: add new warm workers
    while (this._workers.length < newSize) {
      this._workers.push(new PoolWorker(this._workers.length, this));
    }

    this._poolSize = this._workers.length;
  }

  /**
   * Dispose: terminate all workers.
   */
  dispose() {
    if (this._adaptiveTimer) {
      clearInterval(this._adaptiveTimer);
      this._adaptiveTimer = null;
    }
    for (const w of this._workers) {
      w.terminate();
    }
    this._workers = [];
    this._queue = [];
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private */
  _init() {
    if (typeof Worker === 'undefined') {
      logger.worker.warn('[ComputePool] Web Workers not available, using fallback mode');
      this._fallbackMode = true;
      return;
    }

    // Size pool to CPU count - 1 (leave main thread headroom)
    const cores = navigator.hardwareConcurrency || 4;
    this._poolSize = Math.max(MIN_WORKERS, Math.min(MAX_WORKERS, cores - 1));

    for (let i = 0; i < this._poolSize; i++) {
      this._workers.push(new PoolWorker(i, this));
    }

    // Start adaptive sizing monitor
    this._adaptiveTimer = setInterval(() => this._adaptiveResize(), ADAPTIVE_CHECK_MS);

    logger.worker.info(`[ComputePool] Initialized with ${this._poolSize} warm workers (${cores} cores detected)`);
  }

  /** @private — Insert task into priority-sorted queue */
  _enqueue(pendingTask) {
    // Binary insert by priority (lower number = higher priority)
    let lo = 0, hi = this._queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._queue[mid].priority <= pendingTask.priority) lo = mid + 1;
      else hi = mid;
    }
    this._queue.splice(lo, 0, pendingTask);
  }

  /**
   * @private — Try to assign a pending task to a specific worker.
   * Uses task affinity: prefer workers that have run the same task type.
   */
  _scheduleNext(worker) {
    if (this._queue.length === 0) return;
    if (worker.busy) return;

    // Task affinity: find best-matching task for this worker
    let bestIdx = 0;
    let bestAffinity = -1;

    for (let i = 0; i < Math.min(this._queue.length, 10); i++) {
      const task = this._queue[i];
      // Only consider same-priority tasks for affinity matching
      if (task.priority !== this._queue[0].priority) break;

      const affinity = worker.getAffinityFor(task.taskType);
      if (affinity > bestAffinity) {
        bestAffinity = affinity;
        bestIdx = i;
      }
    }

    const task = this._queue.splice(bestIdx, 1)[0];
    this._totalCompleted++;
    worker.execute(task);
  }

  /** @private — Assign pending tasks to all idle workers */
  _scheduleAll() {
    for (const worker of this._workers) {
      if (!worker.busy && this._queue.length > 0) {
        this._scheduleNext(worker);
      }
    }
  }

  /**
   * @private — Adaptive pool sizing.
   * Grows pool if queue builds up, shrinks if idle for too long.
   */
  _adaptiveResize() {
    const queueLen = this._queue.length;
    const busyCount = this._workers.filter(w => w.busy).length;
    const now = Date.now();

    // Grow: queue building up and all workers busy
    if (queueLen > QUEUE_GROW_THRESHOLD && busyCount === this._workers.length) {
      const newSize = Math.min(this._maxPoolSize, this._workers.length + 1);
      if (newSize > this._workers.length) {
        this.resize(newSize);
      }
    }

    // Shrink: queue empty and pool over min size for a while
    if (queueLen <= QUEUE_SHRINK_THRESHOLD && this._workers.length > this._minPoolSize) {
      const idleWorkers = this._workers.filter(w => !w.busy && (now - w.lastActiveTime) > SHRINK_IDLE_MS);
      if (idleWorkers.length > 0 && this._workers.length > this._minPoolSize) {
        this.resize(this._workers.length - 1);
      }
    }
  }

  /** @private — Fallback: run task on main thread */
  async _runOnMainThread(task) {
    // Import the compute worker logic dynamically
    try {
      const { computeTask } = await import('./ComputeWorker.js');
      return computeTask(task);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      throw new Error('Fallback computation failed');
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const computePool = new _ComputeWorkerPool();
export default computePool;

