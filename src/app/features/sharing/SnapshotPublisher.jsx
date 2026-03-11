// ═══════════════════════════════════════════════════════════════════
// charEdge v10.1 — Snapshot Publisher
// Sprint 5 C5.8: Capture chart canvas → annotate → publish to social.
//
// Flow:
//   1. User clicks Ctrl+S or 📸 button on chart
//   2. Canvas captured as PNG with watermark
//   3. Modal opens with preview + caption editor
//   4. Publish → creates social snapshot in SocialService
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import LabsBadge from '../../components/ui/LabsBadge.jsx';
import toast from '../../components/ui/Toast.jsx';
import { ModalOverlay, Btn, inputStyle } from '../../components/ui/UIKit.jsx';
import { createAnnotatedSnapshot } from '@/charting_library/utils/chartExport';
import { logger } from '@/observability/logger';

/**
 * Snapshot publisher modal.
 *
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {HTMLCanvasElement} canvas - Chart canvas to capture
 * @param {Object} chartInfo - { symbol, tf, chartType }
 */
export default function SnapshotPublisher({ isOpen, onClose, canvas, chartInfo = {} }) {
  const [imageData, setImageData] = useState(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [publishing, setPublishing] = useState(false);
  const captionRef = useRef(null);

  // Capture canvas on open
  useEffect(() => {
    if (!isOpen || !canvas) return;
    try {
      const annotations = {
        symbol: chartInfo.symbol || '',
        timeframe: chartInfo.tf || '',
        timestamp: new Date().toLocaleString(),
      };
      const data = createAnnotatedSnapshot(canvas, annotations);
      setImageData(data);
      setCaption(`${chartInfo.symbol || 'Chart'} ${(chartInfo.tf || '').toUpperCase()} Analysis`);
      setTags(chartInfo.symbol ? chartInfo.symbol.toLowerCase() : '');
    } catch (err) {
      logger.ui.error('Snapshot capture failed:', err);
      toast.error('Failed to capture chart');
      onClose();
    }
  }, [isOpen, canvas, chartInfo, onClose]);

  // Focus caption on open
  useEffect(() => {
    if (isOpen && captionRef.current) {
      setTimeout(() => captionRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handlePublish = useCallback(async () => {
    if (!imageData) return;
    setPublishing(true);

    try {
      // Dynamic import to avoid circular deps
      const { publishSnapshot } = await import('../../../data/SocialService.js');

      await publishSnapshot({
        image: imageData,
        caption: caption.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        symbol: chartInfo.symbol,
        timeframe: chartInfo.tf,
        chartType: chartInfo.chartType,
        createdAt: new Date().toISOString(),
      });

      toast.success('Snapshot published to your feed!');
      onClose();
      setCaption('');
      setTags('');
    } catch (err) {
      logger.ui.error('Publish failed:', err);
      toast.error('Failed to publish snapshot');
    } finally {
      setPublishing(false);
    }
  }, [imageData, caption, tags, chartInfo, onClose]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!imageData) return;
    try {
      // Convert dataURL to blob
      const res = await fetch(imageData);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Chart copied to clipboard');
    } catch {
      toast.error('Clipboard copy failed');
    }
  }, [imageData]);

  const handleDownload = useCallback(() => {
    if (!imageData) return;
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `${chartInfo.symbol || 'chart'}-${ts}.png`;
    link.href = imageData;
    link.click();
    toast.success('Chart saved');
  }, [imageData, chartInfo]);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div
        style={{
          maxWidth: 540,
          width: '100%',
          background: C.sf,
          borderRadius: 12,
          border: `1px solid ${C.bd}`,
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${C.bd}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F, display: 'flex', alignItems: 'center', gap: 8 }}>Publish Snapshot <LabsBadge /></div>
          <button
            className="tf-btn"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Preview */}
          {imageData && (
            <div
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: `1px solid ${C.bd}`,
                marginBottom: 12,
              }}
            >
              <img src={imageData} alt="Chart snapshot" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )}

          {/* Caption */}
          <div style={{ marginBottom: 10 }}>
            <label
              style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M, display: 'block', marginBottom: 3 }}
            >
              CAPTION
            </label>
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's your analysis?"
              rows={2}
              maxLength={280}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 48, lineHeight: 1.5 }}
            />
            <div style={{ fontSize: 9, color: C.t3, textAlign: 'right', marginTop: 2 }}>{caption.length}/280</div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M, display: 'block', marginBottom: 3 }}
            >
              TAGS
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="btc, analysis, breakout"
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={handleDownload} style={{ fontSize: 11, flex: 1 }}>
              💾 Save
            </Btn>
            <Btn variant="ghost" onClick={handleCopyToClipboard} style={{ fontSize: 11, flex: 1 }}>
              📋 Copy
            </Btn>
            <Btn onClick={handlePublish} disabled={publishing} style={{ fontSize: 11, flex: 2 }}>
              {publishing ? 'Publishing...' : '🚀 Publish'}
            </Btn>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

export { SnapshotPublisher };
