// ═══════════════════════════════════════════════════════════════════
// charEdge — Storage Dashboard (Sprint 10)
//
// Storage breakdown with donut chart visualization:
//   - Per-category size display
//   - Total usage vs. quota
//   - Clear cache button
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const CATEGORY_COLORS = ['#228BE6', '#16A34A', '#D97706', '#7C3AED', '#E11D48'];

function StorageDashboard() {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    try {
      const estimate = await navigator.storage?.estimate?.() || { usage: 0, quota: 0 };

      // Estimate category sizes
      const lsSize = new Blob([JSON.stringify(localStorage)]).size;
      const categories = [
        { name: 'Trades & Journal', size: Math.max(lsSize * 0.5, 1024), color: CATEGORY_COLORS[0] },
        { name: 'Settings', size: Math.max(lsSize * 0.15, 512), color: CATEGORY_COLORS[1] },
        { name: 'AI Models', size: Math.max((estimate.usage || 0) * 0.3, 0), color: CATEGORY_COLORS[2] },
        { name: 'Cache', size: Math.max((estimate.usage || 0) * 0.2, 0), color: CATEGORY_COLORS[3] },
        { name: 'Other', size: Math.max((estimate.usage || 0) * 0.1, 0), color: CATEGORY_COLORS[4] },
      ];

      setStorageData({
        total: estimate.usage || lsSize,
        quota: estimate.quota || 50 * 1024 * 1024,
        categories,
      });
    } catch {
      setStorageData({
        total: 0, quota: 50 * 1024 * 1024,
        categories: [{ name: 'Unknown', size: 0, color: CATEGORY_COLORS[0] }],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStorage(); }, [fetchStorage]);

  // Draw donut chart
  useEffect(() => {
    if (!storageData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 100;
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2); // Retina

    const cx = size / 2, cy = size / 2, r = 36, inner = 22;
    const total = Math.max(storageData.categories.reduce((a, c) => a + c.size, 0), 1);
    let startAngle = -Math.PI / 2;

    storageData.categories.forEach((cat) => {
      const slice = (cat.size / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.arc(cx, cy, inner, startAngle + slice, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();
      startAngle += slice;
    });

    // Center text
    ctx.fillStyle = C.t1;
    ctx.font = `700 11px ${F}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatBytes(storageData.total), cx, cy - 4);
    ctx.fillStyle = C.t3;
    ctx.font = `600 8px ${F}`;
    ctx.fillText('used', cx, cy + 7);
  }, [storageData]);

  const handleClearCache = useCallback(async () => {
    try {
      const cacheNames = await caches?.keys() || [];
      for (const name of cacheNames) await caches.delete(name);
      toast.success('Cache cleared');
      fetchStorage();
    } catch {
      toast.error('Failed to clear cache');
    }
  }, [fetchStorage]);

  const usagePercent = storageData
    ? Math.round((storageData.total / storageData.quota) * 100)
    : 0;

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
        Storage
      </div>
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
        {loading ? 'Calculating...' : `${formatBytes(storageData?.total || 0)} of ${formatBytes(storageData?.quota || 0)} (${usagePercent}%)`}
      </div>

      {!loading && storageData && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
            {/* Donut chart */}
            <canvas ref={canvasRef} style={{ width: 100, height: 100, flexShrink: 0 }} />

            {/* Category breakdown */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {storageData.categories.filter(c => c.size > 0).map((cat) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 11, color: C.t2, fontFamily: F }}>{cat.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.t1, fontFamily: M }}>{formatBytes(cat.size)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quota bar */}
          {usagePercent > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                height: 4, borderRadius: 2, background: C.bd + '20',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: usagePercent > 80 ? C.r : C.b,
                  width: `${Math.min(usagePercent, 100)}%`,
                  transition: `width ${transition.base}`,
                }} />
              </div>
              {usagePercent > 80 && (
                <div style={{ fontSize: 10, color: C.r, fontFamily: F, marginTop: 4, fontWeight: 600 }}>
                  ⚠️ Storage usage is above 80%
                </div>
              )}
            </div>
          )}

          <Btn variant="ghost" onClick={handleClearCache}
            style={{ fontSize: 11, padding: '6px 12px' }}>
            🗑 Clear Cache
          </Btn>
        </>
      )}
    </Card>
  );
}

export default React.memo(StorageDashboard);
