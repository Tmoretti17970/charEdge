// ═══════════════════════════════════════════════════════════════════
// charEdge — Voice Commands Hook (Sprint 69)
//
// React hook that binds VoiceToChart + VoiceCommandProcessor +
// optional Groq Whisper for high-accuracy transcription.
//
// Usage:
//   const { isRecording, lastCommand, startRecording, status } = useVoiceCommands();
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceCommand } from '../ai/VoiceCommandProcessor';

interface VoiceCommandsState {
  isRecording: boolean;
  status: 'idle' | 'recording' | 'processing' | 'error';
  lastCommand: VoiceCommand | null;
  transcript: string;
  error: string | null;
}

export function useVoiceCommands(onCommand?: (cmd: VoiceCommand) => void) {
  const [state, setState] = useState<VoiceCommandsState>({
    isRecording: false,
    status: 'idle',
    lastCommand: null,
    transcript: '',
    error: null,
  });

  const voiceRef = useRef<unknown>(null);
  const processorRef = useRef<unknown>(null);

  // Lazy-load voice modules
  const ensureModules = useCallback(async () => {
    if (!voiceRef.current) {
      const { voiceToChart } = await import('../ai/VoiceToChart');
      voiceRef.current = voiceToChart;
    }
    if (!processorRef.current) {
      const { voiceProcessor } = await import('../ai/VoiceCommandProcessor');
      processorRef.current = voiceProcessor;
    }
  }, []);

  const startRecording = useCallback(async () => {
    await ensureModules();
    const voice = voiceRef.current as { startRecording: () => Promise<boolean> };

    setState(s => ({ ...s, isRecording: true, status: 'recording', error: null }));

    const started = await voice.startRecording();
    if (!started) {
      setState(s => ({ ...s, isRecording: false, status: 'error', error: 'Failed to start recording' }));
    }
  }, [ensureModules]);

  const stopRecording = useCallback(async () => {
    const voice = voiceRef.current as { stopRecording: () => Promise<{ text: string; audioBlob: Blob | null }> } | null;
    const processor = processorRef.current as { parse: (t: string) => VoiceCommand } | null;

    if (!voice || !processor) {
      setState(s => ({ ...s, isRecording: false, status: 'idle' }));
      return;
    }

    setState(s => ({ ...s, status: 'processing' }));

    try {
      const result = await voice.stopRecording();
      let transcriptText = result.text;

      // Try Groq Whisper for better accuracy if available
      if (result.audioBlob && result.audioBlob.size > 1000) {
        try {
          const { groqAdapter } = await import('../ai/GroqAdapter');
          if (groqAdapter.isAvailable) {
            const whisperResult = await groqAdapter.transcribe(result.audioBlob);
            if (whisperResult.text?.length > 0) {
              transcriptText = whisperResult.text;
            }
          }
        } catch {
          // Fall back to Web Speech API transcript
        }
      }

      // Parse the command
      const command = processor.parse(transcriptText);

      setState(s => ({
        ...s,
        isRecording: false,
        status: 'idle',
        lastCommand: command,
        transcript: transcriptText,
      }));

      onCommand?.(command);
    } catch (err: unknown) {
      setState(s => ({
        ...s,
        isRecording: false,
        status: 'error',
        error: err instanceof Error ? err.message : 'Processing failed',
      }));
    }
  }, [onCommand]);

  // Keyboard shortcut: hold V to record
  useEffect(() => {
    let isHolding = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey && !e.altKey && !isHolding) {
        // Don't trigger in text inputs
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        isHolding = true;
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'v' && isHolding) {
        isHolding = false;
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}

export default useVoiceCommands;
