// ═══════════════════════════════════════════════════════════════════
// charEdge — Personal Model Trainer (Sprint 86)
//
// TF.js-based 3-layer dense network trained on user's own trades.
// Predicts win probability for new setups. Model weights saved to
// IndexedDB for persistence across sessions.
//
// Usage:
//   import { personalModelTrainer } from './PersonalModelTrainer';
//   await personalModelTrainer.train(trades);
//   const prediction = await personalModelTrainer.predict(features);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface TrainingResult {
  epochs: number;
  finalLoss: number;
  accuracy: number;
  sampleSize: number;
  timestamp: number;
}

export interface PredictionResult {
  winProbability: number;
  confidence: number;
  signal: 'green' | 'yellow' | 'red';
}

interface TradeFeatures {
  hour: number; // 0–23
  dayOfWeek: number; // 0–6
  setupIdx: number; // encoded setup type
  emotionIdx: number; // encoded emotion
  holdMinutes: number;
  positionSize: number;
}

// ─── Constants ──────────────────────────────────────────────────

const MODEL_KEY = 'charEdge-personal-model';
const SETUP_MAP: Record<string, number> = {
  breakout: 1,
  breakdown: 2,
  pullback: 3,
  reversal: 4,
  continuation: 5,
  scalp: 6,
  swing: 7,
  momentum: 8,
};
const EMOTION_MAP: Record<string, number> = {
  calm: 1,
  confident: 2,
  anxious: 3,
  fearful: 4,
  greedy: 5,
  frustrated: 6,
  revenge: 7,
  neutral: 8,
};

// ─── Trainer ────────────────────────────────────────────────────

class PersonalModelTrainer {
  private _model: unknown = null;
  private _tf: unknown = null;
  private _isTraining = false;
  private _lastTraining: TrainingResult | null = null;

  /**
   * Train on user's historical trades.
   */
  async train(trades: Record<string, unknown>[], epochs = 50): Promise<TrainingResult> {
    if (this._isTraining) throw new Error('Training already in progress');
    if (trades.length < 20) throw new Error('Need at least 20 trades to train');

    this._isTraining = true;

    try {
      const tf = await this._loadTF();
      const { xs, ys } = this._prepareData(tf, trades);

      // Build model
      const model = tf.sequential();
      model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [6] }));
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });

      // Train
      const history = await model.fit(xs, ys, {
        epochs,
        batchSize: Math.min(32, Math.floor(trades.length / 2)),
        validationSplit: 0.2,
        shuffle: true,
      });

      this._model = model;

      // Save weights
      await this._saveModel(model);

      const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
      const acc = history.history.acc ? (history.history.acc[history.history.acc.length - 1] as number) : 0;

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

      this._lastTraining = {
        epochs,
        finalLoss: Math.round(finalLoss * 1000) / 1000,
        accuracy: Math.round((acc || 0) * 100),
        sampleSize: trades.length,
        timestamp: Date.now(),
      };

      return this._lastTraining;
    } finally {
      this._isTraining = false;
    }
  }

  /**
   * Predict win probability for a new setup.
   */
  async predict(setup: {
    hour?: number;
    dayOfWeek?: number;
    setupType?: string;
    emotion?: string;
    holdMinutes?: number;
    positionSize?: number;
  }): Promise<PredictionResult> {
    const model = await this._getModel();
    if (!model) {
      return { winProbability: 0.5, confidence: 0, signal: 'yellow' };
    }

    const tf = await this._loadTF();
    const features = this._normalizeFeatures({
      hour: setup.hour ?? new Date().getHours(),
      dayOfWeek: setup.dayOfWeek ?? new Date().getDay(),
      setupIdx: SETUP_MAP[setup.setupType?.toLowerCase() || ''] || 0,
      emotionIdx: EMOTION_MAP[setup.emotion?.toLowerCase() || ''] || 0,
      holdMinutes: setup.holdMinutes || 30,
      positionSize: setup.positionSize || 100,
    });

    const tensor = tf.tensor2d([features]);
    const prediction = (model as { predict: (t: unknown) => { dataSync: () => Float32Array } }).predict(tensor);
    const prob = prediction.dataSync()[0];
    tensor.dispose();

    const confidence = Math.abs(prob - 0.5) * 200; // 0–100
    const signal = prob >= 0.6 ? 'green' : prob >= 0.4 ? 'yellow' : 'red';

    return {
      winProbability: Math.round(prob * 100) / 100,
      confidence: Math.round(confidence),
      signal,
    };
  }

  get isTraining() {
    return this._isTraining;
  }
  get lastTraining() {
    return this._lastTraining;
  }

  // ─── Data Prep ───────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TensorFlow.js has no published type for the tf namespace object
  private _prepareData(tf: any, trades: Record<string, unknown>[]) {
    const features: number[][] = [];
    const labels: number[] = [];

    for (const t of trades) {
      if (typeof t.pnl !== 'number') continue;

      const d = t.entryTime ? new Date(t.entryTime as string | number) : new Date((t.date as string) || '');
      const f: TradeFeatures = {
        hour: isNaN(d.getTime()) ? 12 : d.getHours(),
        dayOfWeek: isNaN(d.getTime()) ? 3 : d.getDay(),
        setupIdx: SETUP_MAP[String(t.setupType || '').toLowerCase()] || 0,
        emotionIdx: EMOTION_MAP[String(t.emotion || '').toLowerCase()] || 0,
        holdMinutes: typeof t.holdMinutes === 'number' ? t.holdMinutes : 30,
        positionSize: typeof t.positionSize === 'number' ? t.positionSize : 100,
      };

      features.push(this._normalizeFeatures(f));
      labels.push(t.pnl > 0 ? 1 : 0);
    }

    return {
      xs: tf.tensor2d(features),
      ys: tf.tensor1d(labels),
    };
  }

  private _normalizeFeatures(f: TradeFeatures): number[] {
    return [
      f.hour / 23,
      f.dayOfWeek / 6,
      f.setupIdx / 8,
      f.emotionIdx / 8,
      Math.min(f.holdMinutes / 480, 1),
      Math.min(f.positionSize / 1000, 1),
    ];
  }

  // ─── Model Loading/Saving ───────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TensorFlow.js module type is dynamic and untyped
  private async _loadTF(): Promise<any> {
    if (this._tf) return this._tf;
    this._tf = await import('@tensorflow/tfjs');
    return this._tf;
  }

  private async _getModel(): Promise<unknown | null> {
    if (this._model) return this._model;

    try {
      const tf = await this._loadTF();
      this._model = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`);
      return this._model;
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TensorFlow.js model type varies by architecture
  private async _saveModel(model: any): Promise<void> {
    try {
      await model.save(`indexeddb://${MODEL_KEY}`);
    } catch {
      /* IndexedDB save failed — non-critical */
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const personalModelTrainer = new PersonalModelTrainer();
export default personalModelTrainer;
