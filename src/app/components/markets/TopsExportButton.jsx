// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Export Button
//
// Compact export button for exporting visible market data as CSV.
// Surfaces existing exportTrades.js downloadFile() utility.
// ═══════════════════════════════════════════════════════════════════

import { memo, useCallback, useState } from 'react';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';
import styles from './TopsExportButton.module.css';

export default memo(function TopsExportButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);

    try {
      const filtered = useTopMarketsStore.getState().getFilteredMarkets();
      if (!filtered.length) return;

      const { downloadFile } = await import('../../../data/importExport/exportTrades.js');

      // Build CSV from market data
      const headers = ['Rank', 'Symbol', 'Name', 'Asset Class', 'Price', '1h %', '24h %', '7d %', 'Market Cap', 'Volume 24h', 'Supply'];
      const rows = filtered.map((m) => [
        m.rank,
        m.symbol,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        m.assetClass,
        m.price,
        m.change1h != null ? m.change1h.toFixed(2) : '',
        m.change24h != null ? m.change24h.toFixed(2) : '',
        m.change7d != null ? m.change7d.toFixed(2) : '',
        m.marketCap || '',
        m.volume24h || '',
        m.supply || '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(csv, `charEdge-markets-${timestamp}.csv`, 'text/csv');
    } catch {
      // downloadFile may fail silently
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <button
      className={styles.exportBtn}
      onClick={handleExport}
      disabled={exporting}
      title="Export market data as CSV"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {exporting ? 'Exporting...' : 'Export'}
    </button>
  );
});
