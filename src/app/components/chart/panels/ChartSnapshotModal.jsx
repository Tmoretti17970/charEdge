// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Snapshot & Share Modal
// One-click chart capture → post to Social Hub
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#1E222D', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    width: 520, maxWidth: '90vw', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  },
  header: {
    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { color: '#E0E3EB', fontSize: 16, fontWeight: 600, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', color: '#787B86',
    fontSize: 20, cursor: 'pointer', padding: 4,
  },
  body: { padding: 20, overflowY: 'auto' },
  preview: {
    width: '100%', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#131722', color: '#E0E3EB', fontSize: 14,
    marginBottom: 12, outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#131722', color: '#E0E3EB', fontSize: 13,
    marginBottom: 16, outline: 'none', resize: 'vertical',
    minHeight: 60, boxSizing: 'border-box', fontFamily: 'inherit',
  },
  footer: {
    padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  btn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #2962FF, #6C5CE7)',
    color: '#fff',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)', color: '#D1D4DC',
  },
};

/**
 * Chart Snapshot & Share Modal
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {HTMLCanvasElement} props.canvas — the chart's main canvas
 * @param {string} props.symbol
 * @param {string} props.timeframe
 * @param {Function} [props.onPost] — callback(snapshotData) when user posts
 */
export default function ChartSnapshotModal({ open, onClose, canvas, symbol, timeframe, onPost }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (open && canvas) {
      try { setPreviewUrl(canvas.toDataURL('image/png')); } catch { setPreviewUrl(null); }
      setTitle(`${symbol || 'Chart'} ${timeframe || ''} Analysis`);
      setDescription('');
    }
  }, [open, canvas, symbol, timeframe]);

  if (!open) return null;

  const handlePost = () => {
    const snapshot = {
      id: `snap_${Date.now()}`,
      title,
      description,
      imageData: previewUrl,
      symbol,
      timeframe,
      timestamp: Date.now(),
      author: 'You',
    };
    if (onPost) onPost(snapshot);
    onClose();
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${symbol || 'chart'}_${timeframe || ''}_${Date.now()}.png`;
    a.click();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📸 Share Chart Snapshot</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {previewUrl && (
            <img ref={imgRef} src={previewUrl} alt="Chart preview" style={styles.preview} />
          )}
          <input
            style={styles.input}
            placeholder="Title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            style={styles.textarea}
            placeholder="Add your analysis or trade idea..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div style={styles.footer}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={handleDownload}>
            ⬇ Download
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handlePost}
            disabled={!title.trim()}
          >
            🚀 Post to Social Hub
          </button>
        </div>
      </div>
    </div>
  );
}
