import { useState, useEffect, useRef } from 'react';
import AIOrb from '../design/AIOrb.jsx';
import useHotkeys from '@/hooks/useHotkeys';
import s from './AICopilotBar.module.css';

export default function AICopilotBar({ onCommand, onClose }) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useHotkeys([{ key: 'Escape', handler: onClose, description: 'Close AI Copilot bar' }], { scope: 'panel' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || feedback) return;
    setIsProcessing(true);
    setTimeout(() => {
      const result = onCommand(input.trim());
      setIsProcessing(false);
      if (result && result.success) setFeedback({ type: 'success', text: result.message });
      else setFeedback({ type: 'error', text: result ? result.message : "I didn't understand that." });
      setTimeout(() => { setFeedback(null); setInput(''); onClose(); }, 1500);
    }, 400);
  };

  return (
    <div className={s.root}>
      <form onSubmit={handleSubmit} className={s.form}>
        <AIOrb size={22} glow />
        {feedback ? (
          <div className={s.feedback} data-type={feedback.type}>{feedback.text}</div>
        ) : (
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to draw, add indicators, or change charts..." disabled={isProcessing} className={s.input} />
        )}
        {isProcessing && <div className={s.spinner} />}
      </form>
      <div className={s.footer}>
        <span>Try: <em>"Add RSI"</em>, <em>"Go to 15m"</em>, <em>"Chart TSLA"</em></span>
        <span><kbd className={s.escKbd}>Esc</kbd> to close</span>
      </div>
    </div>
  );
}
