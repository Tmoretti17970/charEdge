// ═══════════════════════════════════════════════════════════════════
// charEdge — Embed Widget Generator
//
// Generates embeddable iframe code for sharing prediction markets.
// Shows a preview and copy-to-clipboard functionality.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback } from 'react';
import { SOURCE_CONFIG, CATEGORY_CONFIG, formatVolume } from '../../../data/schemas/PredictionMarketSchema.js';
import styles from './EmbedWidget.module.css';

export default memo(function EmbedWidget({ market, onClose }) {
  const [theme, setTheme] = useState('dark');
  const [size, setSize] = useState('compact'); // 'compact' | 'full'
  const [copied, setCopied] = useState(false);

  const lead = market?.outcomes?.[0];
  const catCfg = CATEGORY_CONFIG[market?.category] || {};
  const srcCfg = SOURCE_CONFIG[market?.source] || {};

  // Generate embed code
  const embedCode = `<div style="border:1px solid ${theme === 'dark' ? '#1e1e2e' : '#e5e5e5'};border-radius:12px;padding:16px;background:${theme === 'dark' ? '#0d0d1a' : '#ffffff'};font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:360px">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${theme === 'dark' ? '#666' : '#999'};margin-bottom:8px">${catCfg.label || market.category}</div>
  <div style="font-size:15px;font-weight:600;color:${theme === 'dark' ? '#e5e5e5' : '#1a1a1a'};margin-bottom:12px">${market.question}</div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:24px;font-weight:700;font-family:monospace;color:${theme === 'dark' ? '#fff' : '#000'}">${lead?.probability || 0}%</span>
    <span style="font-size:12px;color:${market.change24h > 0 ? '#22c55e' : market.change24h < 0 ? '#ef4444' : '#666'}">${market.change24h > 0 ? '+' : ''}${market.change24h || 0}% 24h</span>
  </div>
  <div style="font-size:11px;color:${theme === 'dark' ? '#555' : '#aaa'}">${formatVolume(market.volume24h)} volume · ${srcCfg.label || market.source}</div>
  <a href="${market.url}" target="_blank" rel="noopener" style="display:block;margin-top:10px;font-size:11px;color:#5c9cf5;text-decoration:none">View on ${srcCfg.label} →</a>
</div>`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [embedCode]);

  if (!market) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Embed Market</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Preview */}
        <div className={styles.preview}>
          <div className={`${styles.previewCard} ${theme === 'light' ? styles.light : ''}`}>
            <div className={styles.previewCat}>{catCfg.label || market.category}</div>
            <div className={styles.previewTitle}>{market.question}</div>
            <div className={styles.previewProb}>
              <span className={styles.previewProbValue}>{lead?.probability || 0}%</span>
              <span
                className={styles.previewDelta}
                style={{ color: market.change24h > 0 ? '#22c55e' : market.change24h < 0 ? '#ef4444' : undefined }}
              >
                {market.change24h > 0 ? '+' : ''}
                {market.change24h || 0}% 24h
              </span>
            </div>
            <div className={styles.previewMeta}>
              {formatVolume(market.volume24h)} volume · {srcCfg.label}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className={styles.options}>
          <div className={styles.optionGroup}>
            <span className={styles.optionLabel}>Theme</span>
            <div className={styles.pillRow}>
              <button
                className={`${styles.pill} ${theme === 'dark' ? styles.pillActive : ''}`}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
              <button
                className={`${styles.pill} ${theme === 'light' ? styles.pillActive : ''}`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
            </div>
          </div>
          <div className={styles.optionGroup}>
            <span className={styles.optionLabel}>Size</span>
            <div className={styles.pillRow}>
              <button
                className={`${styles.pill} ${size === 'compact' ? styles.pillActive : ''}`}
                onClick={() => setSize('compact')}
              >
                Compact
              </button>
              <button
                className={`${styles.pill} ${size === 'full' ? styles.pillActive : ''}`}
                onClick={() => setSize('full')}
              >
                Full
              </button>
            </div>
          </div>
        </div>

        {/* Code */}
        <div className={styles.codeWrap}>
          <pre className={styles.code}>{embedCode}</pre>
        </div>

        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? '✓ Copied!' : 'Copy Embed Code'}
        </button>
      </div>
    </div>
  );
});
