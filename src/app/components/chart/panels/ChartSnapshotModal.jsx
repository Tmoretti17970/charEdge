// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Snapshot & Share Modal
// One-click chart capture → post to Social Hub
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import s from './ChartSnapshotModal.module.css';

export default function ChartSnapshotModal({ open, onClose, canvas, symbol, timeframe, onPost }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [embedSnippet, setEmbedSnippet] = useState('');
  const imgRef = useRef(null);

  const captureHiDPI = (srcCanvas, scale = 3) => {
    if (!srcCanvas) return null;
    try {
      const w = srcCanvas.width * scale;
      const h = srcCanvas.height * scale;
      const offscreen = document.createElement('canvas');
      offscreen.width = w; offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcCanvas, 0, 0, w, h);
      const fs = Math.round(14 * scale);
      ctx.font = `bold ${fs}px Arial`; ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      ctx.fillText(`${symbol || 'Chart'} · ${timeframe || ''} · ${dateStr} · charEdge`, w - Math.round(12 * scale), h - Math.round(8 * scale));
      return offscreen.toDataURL('image/png');
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { return null; }
  };

  useEffect(() => {
    if (open && canvas) {
      const url = captureHiDPI(canvas);
      // eslint-disable-next-line unused-imports/no-unused-vars
      setPreviewUrl(url || (() => { try { return canvas.toDataURL('image/png'); } catch (_) { return null; } })());
      setTitle(`${symbol || 'Chart'} ${timeframe || ''} Analysis`);
      setDescription(''); setCopyStatus('');
      setEmbedSnippet(`<iframe src="${window.location.origin}/embed/${(symbol || 'BTC').toLowerCase()}?tf=${timeframe || '1D'}" width="800" height="450" frameborder="0" style="border-radius:8px;"></iframe>`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canvas, symbol, timeframe]);

  if (!open) return null;

  const handlePost = () => {
    const snapshot = { id: `snap_${Date.now()}`, title, description, imageData: previewUrl, symbol, timeframe, timestamp: Date.now(), author: 'You' };
    if (onPost) onPost(snapshot); onClose();
  };
  const handleDownload = () => { if (!previewUrl) return; const a = document.createElement('a'); a.href = previewUrl; a.download = `${symbol || 'chart'}_${timeframe || ''}_${Date.now()}.png`; a.click(); };
  const handleCopyToClipboard = async () => {
    if (!previewUrl) return;
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { const resp = await fetch(previewUrl); const blob = await resp.blob(); await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); setCopyStatus('Copied!'); setTimeout(() => setCopyStatus(''), 2000); } catch (_) { setCopyStatus('Failed'); setTimeout(() => setCopyStatus(''), 2000); }
  };
  // eslint-disable-next-line unused-imports/no-unused-vars
  const handleCopyEmbed = () => { try { navigator.clipboard.writeText(embedSnippet); setCopyStatus('Embed copied!'); setTimeout(() => setCopyStatus(''), 2000); } catch (_) { /* */ } };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <h3 className={s.title}>📸 Share Chart Snapshot</h3>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={s.body}>
          {previewUrl && <img ref={imgRef} src={previewUrl} alt="Chart preview" className={s.preview} />}
          <input className={s.input} placeholder="Title..." value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className={s.textarea} placeholder="Add your analysis or trade idea..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div className={s.embedRow}>
            <div className={s.embedLabel}>
              <span className={s.embedLabelText}>Embed Code</span>
              <button onClick={handleCopyEmbed} className={s.btnSecondary} style={{ padding: '2px 8px', fontSize: 11 }}>📋 Copy</button>
            </div>
            <textarea className={s.embedTextarea} value={embedSnippet} readOnly />
          </div>
        </div>
        <div className={s.footer}>
          {copyStatus && <span className={s.copyStatus}>✓ {copyStatus}</span>}
          <button className={s.btnSecondary} onClick={handleCopyToClipboard}>📋 Copy to Clipboard</button>
          <button className={s.btnSecondary} onClick={handleDownload}>⬇ Download</button>
          <button className={s.btnPrimary} onClick={handlePost} disabled={!title.trim()}>🚀 Post to Social Hub</button>
        </div>
      </div>
    </div>
  );
}
