// ═══════════════════════════════════════════════════════════════════
// charEdge — Voice-to-Chart Note (Task 4.2.8)
//
// Hold V → start recording via MediaRecorder + SpeechRecognition.
// Release V → stop, transcribe, create chart annotation at current candle.
//
// Uses Web Speech API for transcription with MediaRecorder as fallback
// for audio storage. Pins transcribed text as note on the bar.
//
// Usage:
//   const voice = new VoiceToChart();
//   voice.startRecording();
//   // ... user speaks
//   const result = await voice.stopRecording();
//   // → { text: 'NVDA looking strong here', audioBlob, timestamp }
// ═══════════════════════════════════════════════════════════════════

// P2 7.3: Consolidated audio storage into UnifiedDB
import { openUnifiedDB } from '../data/UnifiedDB.js';

// ─── Types ───────────────────────────────────────────────────────

export interface VoiceNoteResult {
    text: string;
    audioBlob: Blob | null;
    timestamp: number;
    duration: number;
    confidence: number;
}

export interface VoiceNoteEntry {
    id: string;
    text: string;
    timestamp: number;
    barTime: number;
    symbol: string;
    timeframe: string;
    duration: number;
    hasAudio: boolean;
}

type VoiceEventType = 'start' | 'stop' | 'transcript' | 'error';
type VoiceEventListener = (type: VoiceEventType, data?: unknown) => void;

// ─── Engine ─────────────────────────────────────────────────────

export class VoiceToChart {
    private _mediaRecorder: MediaRecorder | null = null;
    private _recognition: unknown = null; // SpeechRecognition
    private _audioChunks: Blob[] = [];
    private _transcript = '';
    private _confidence = 0;
    private _isRecording = false;
    private _startTime = 0;
    private _listeners: VoiceEventListener[] = [];
    private _stream: MediaStream | null = null;

    // ─── Public API ─────────────────────────────────────────────────

    /**
     * Check if browser supports voice recording.
     */
    isSupported(): boolean {
        const hasMR = typeof MediaRecorder !== 'undefined';
        const hasSR = typeof window !== 'undefined' &&
            ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
        return hasMR && hasSR;
    }

    /**
     * Check if currently recording.
     */
    get recording(): boolean {
        return this._isRecording;
    }

    /**
     * Start recording audio + transcription.
     * Returns a promise that resolves when recording has actually started.
     */
    async startRecording(): Promise<boolean> {
        if (this._isRecording) return false;
        if (!this.isSupported()) {
            this._emit('error', { message: 'Voice recording not supported in this browser' });
            return false;
        }

        try {
            // Request microphone access
            this._stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });

            // Setup MediaRecorder for audio capture
            this._audioChunks = [];
            this._mediaRecorder = new MediaRecorder(this._stream, {
                mimeType: this._getSupportedMimeType(),
            });
            this._mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this._audioChunks.push(e.data);
            };
            this._mediaRecorder.start(100); // 100ms chunks

            // Setup SpeechRecognition for transcription
            this._transcript = '';
            this._confidence = 0;
            this._setupRecognition();

            this._isRecording = true;
            this._startTime = Date.now();
            this._emit('start');
            return true;
        } catch (err) {
            this._emit('error', { message: `Microphone access denied: ${err}` });
            this._cleanup();
            return false;
        }
    }

    /**
     * Stop recording and return the transcription + audio.
     */
    async stopRecording(): Promise<VoiceNoteResult> {
        if (!this._isRecording) {
            return { text: '', audioBlob: null, timestamp: Date.now(), duration: 0, confidence: 0 };
        }

        const duration = Date.now() - this._startTime;

        // Stop recognition
        if (this._recognition) {
            try {
                this._recognition.stop();
            } catch {
                // May already be stopped
            }
        }

        // Stop media recorder and collect audio
        const audioBlob = await this._stopMediaRecorder();

        this._isRecording = false;
        this._emit('stop');
        this._cleanup();

        const result: VoiceNoteResult = {
            text: this._transcript.trim(),
            audioBlob,
            timestamp: Date.now(),
            duration,
            confidence: this._confidence,
        };

        return result;
    }

    /**
     * Cancel recording without saving.
     */
    cancelRecording(): void {
        if (!this._isRecording) return;
        this._isRecording = false;
        if (this._recognition) {
            try { this._recognition.abort(); } catch { /* */ }
        }
        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
            try { this._mediaRecorder.stop(); } catch { /* */ }
        }
        this._cleanup();
    }

    // ─── Events ─────────────────────────────────────────────────────

    on(listener: VoiceEventListener): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter((l) => l !== listener);
        };
    }

    private _emit(type: VoiceEventType, data?: unknown): void {
        for (const l of this._listeners) {
            try { l(type, data); } catch { /* */ }
        }
    }

    // ─── Audio Storage ──────────────────────────────────────────────

    /**
     * Store audio blob in IndexedDB for later playback.
     */
    async storeAudio(noteId: string, audioBlob: Blob): Promise<void> {
        try {
            const db = await this._openDB();
            const tx = db.transaction('audioNotes', 'readwrite');
            tx.objectStore('audioNotes').put({ id: noteId, audio: audioBlob, timestamp: Date.now() });
            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch {
            // IndexedDB storage is best-effort
        }
    }

    /**
     * Retrieve audio blob from IndexedDB.
     */
    async getAudio(noteId: string): Promise<Blob | null> {
        try {
            const db = await this._openDB();
            const tx = db.transaction('audioNotes', 'readonly');
            const req = tx.objectStore('audioNotes').get(noteId);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result?.audio || null);
                req.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    }

    // ─── Internals ──────────────────────────────────────────────────

    private _setupRecognition(): void {
        const SpeechRecognition = (window as unknown).SpeechRecognition || (window as unknown).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this._recognition = new SpeechRecognition();
        this._recognition.continuous = true;
        this._recognition.interimResults = true;
        this._recognition.lang = 'en-US';

        this._recognition.onresult = (event: unknown) => {
            let interim = '';
            let final = '';
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                    this._confidence = Math.max(this._confidence, result[0].confidence || 0);
                } else {
                    interim += result[0].transcript;
                }
            }
            this._transcript = final || interim;
            this._emit('transcript', { text: this._transcript, isFinal: !!final });
        };

        this._recognition.onerror = (event: unknown) => {
            if (event.error !== 'aborted') {
                this._emit('error', { message: `Speech recognition: ${event.error}` });
            }
        };

        try {
            this._recognition.start();
        } catch {
            // May fail if already started
        }
    }

    private _stopMediaRecorder(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this._mediaRecorder || this._mediaRecorder.state === 'inactive') {
                const blob = this._audioChunks.length > 0
                    ? new Blob(this._audioChunks, { type: this._getSupportedMimeType() })
                    : null;
                resolve(blob);
                return;
            }

            this._mediaRecorder.onstop = () => {
                const blob = this._audioChunks.length > 0
                    ? new Blob(this._audioChunks, { type: this._getSupportedMimeType() })
                    : null;
                resolve(blob);
            };

            try {
                this._mediaRecorder.stop();
            } catch {
                resolve(null);
            }
        });
    }

    private _getSupportedMimeType(): string {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const type of types) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'audio/webm';
    }

    // P2 7.3: Use UnifiedDB instead of private 'charEdge-voice-notes' database
    private async _openDB(): Promise<IDBDatabase> {
        return openUnifiedDB();
    }

    private _cleanup(): void {
        if (this._stream) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
        }
        this._mediaRecorder = null;
        this._recognition = null;
        this._audioChunks = [];
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const voiceToChart = new VoiceToChart();
export default voiceToChart;
