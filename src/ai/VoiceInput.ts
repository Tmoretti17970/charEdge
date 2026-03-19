// ═══════════════════════════════════════════════════════════════════
// charEdge — Voice Input (AI Copilot Sprint 19)
//
// Web Speech API integration for hands-free copilot interaction.
// Handles microphone input, transcription, and TTS read-aloud.
//
// Usage:
//   import { voiceInput } from './VoiceInput';
//   voiceInput.startListening((text) => console.log(text));
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type TranscriptCallback = (text: string, isFinal: boolean) => void;

export interface VoiceStatus {
  listening: boolean;
  speaking: boolean;
  supported: boolean;
  error: string | null;
}

// ─── Trading Vocabulary ─────────────────────────────────────────

const TRADING_CORRECTIONS: Record<string, string> = {
  'bitcoin': 'BTC', 'ethereum': 'ETH', 'solana': 'SOL',
  'to the moon': 'bullish', 'tanking': 'bearish',
  'our side': 'RSI', 'our essay': 'RSI',
  'email': 'EMA', 'Bollinger': 'Bollinger',
  'mac d': 'MACD', 'mack d': 'MACD', 'mac dee': 'MACD',
  'stop loss': 'stop-loss', 'take profit': 'take-profit',
  'v wap': 'VWAP', 'v whap': 'VWAP',
};

// ─── Voice Engine ───────────────────────────────────────────────

export class VoiceInput {
  private _recognition: any = null;
  private _synthesis: SpeechSynthesis | null = null;
  private _status: VoiceStatus = {
    listening: false,
    speaking: false,
    supported: false,
    error: null,
  };
  private _onTranscript: TranscriptCallback | null = null;

  constructor() {
    this._status.supported = this._checkSupport();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this._synthesis = window.speechSynthesis;
    }
  }

  get status(): VoiceStatus {
    return { ...this._status };
  }

  /**
   * Check if speech recognition is supported.
   */
  isSupported(): boolean {
    return this._status.supported;
  }

  /**
   * Start listening for voice input.
   */
  startListening(onTranscript: TranscriptCallback): boolean {
    if (!this._status.supported) {
      this._status.error = 'Speech recognition not supported in this browser';
      return false;
    }

    if (this._status.listening) return true;

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this._recognition = new SpeechRecognition();
      this._recognition.continuous = true;
      this._recognition.interimResults = true;
      this._recognition.lang = 'en-US';
      this._onTranscript = onTranscript;

      this._recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const corrected = this._correctTradingTerms(finalTranscript);
          this._onTranscript?.(corrected, true);
        } else if (interimTranscript) {
          this._onTranscript?.(interimTranscript, false);
        }
      };

      this._recognition.onerror = (event: any) => {
        this._status.error = event.error;
        if (event.error === 'not-allowed' || event.error === 'no-speech') {
          this.stopListening();
        }
      };

      this._recognition.onend = () => {
        this._status.listening = false;
      };

      this._recognition.start();
      this._status.listening = true;
      this._status.error = null;
      return true;
    } catch (err) {
      this._status.error = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  /**
   * Stop listening.
   */
  stopListening(): void {
    if (this._recognition) {
      try { this._recognition.stop(); } catch { /* ignore */ }
      this._recognition = null;
    }
    this._status.listening = false;
    this._onTranscript = null;
  }

  /**
   * Read text aloud using TTS.
   */
  readAloud(text: string, rate = 1.0): Promise<void> {
    return new Promise((resolve) => {
      if (!this._synthesis) {
        resolve();
        return;
      }

      // Cancel any current speech
      this._synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => { this._status.speaking = true; };
      utterance.onend = () => { this._status.speaking = false; resolve(); };
      utterance.onerror = () => { this._status.speaking = false; resolve(); };

      this._synthesis.speak(utterance);
    });
  }

  /**
   * Stop TTS playback.
   */
  stopSpeaking(): void {
    if (this._synthesis) {
      this._synthesis.cancel();
      this._status.speaking = false;
    }
  }

  /**
   * Toggle listening on/off.
   */
  toggle(onTranscript: TranscriptCallback): boolean {
    if (this._status.listening) {
      this.stopListening();
      return false;
    }
    return this.startListening(onTranscript);
  }

  // ── Internal ────────────────────────────────────────────────

  private _checkSupport(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  private _correctTradingTerms(text: string): string {
    let corrected = text;
    for (const [wrong, right] of Object.entries(TRADING_CORRECTIONS)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, right);
    }
    return corrected;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const voiceInput = new VoiceInput();
export default voiceInput;
