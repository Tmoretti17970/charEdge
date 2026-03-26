// ═══════════════════════════════════════════════════════════════════
// charEdge — Share Market Card
//
// Generates shareable text/links for prediction markets.
// Copy link, share to Twitter/Discord.
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useCallback } from 'react';
import { formatVolume, SOURCE_CONFIG } from '../../../data/schemas/PredictionMarketSchema.js';
import styles from './ShareMarketCard.module.css';

export default memo(function ShareMarketCard({ market, onClose }) {
  const [copied, setCopied] = useState(false);

  const lead = market?.outcomes?.[0];
  const srcCfg = SOURCE_CONFIG[market?.source] || {};
  const delta = market?.change24h || 0;
  const deltaStr = delta > 0 ? `+${delta}%` : `${delta}%`;

  // Shareable text
  const shareText = `${market.question}\n\n${lead?.label || 'Yes'}: ${lead?.probability || 0}% (${deltaStr} 24h)\nVolume: ${formatVolume(market.volume24h)}\n\n${market.url}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(market.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [market.url]);

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareText]);

  if (!market) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Share Market</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Preview card */}
        <div className={styles.preview}>
          <div className={styles.previewQuestion}>{market.question}</div>
          <div className={styles.previewStats}>
            <span className={styles.previewProb}>{lead?.probability || 0}%</span>
            <span
              className={styles.previewDelta}
              style={{ color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : undefined }}
            >
              {deltaStr}
            </span>
            <span className={styles.previewVol}>{formatVolume(market.volume24h)}</span>
            <span className={styles.previewSource}>{srcCfg.label}</span>
          </div>
        </div>

        {/* Share options */}
        <div className={styles.shareOptions}>
          <button className={styles.shareBtn} onClick={handleCopyLink}>
            <span className={styles.shareBtnIcon}>🔗</span>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button className={styles.shareBtn} onClick={handleCopyText}>
            <span className={styles.shareBtnIcon}>📋</span>
            Copy Text
          </button>
          <a className={styles.shareBtn} href={twitterUrl} target="_blank" rel="noopener noreferrer">
            <span className={styles.shareBtnIcon}>𝕏</span>
            Share on X
          </a>
        </div>
      </div>
    </div>
  );
});
