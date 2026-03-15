import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { SymbolRegistry } from '../../../data/SymbolRegistry.js';
import { captureChartScreenshot } from '../../../hooks/useAutoScreenshot.js';
import { useJournalStore } from '../../../state/useJournalStore';
import JournalQuickAdd from '../../features/journal/journal_ui/JournalQuickAdd.jsx';
import { toast } from '../ui/Toast.jsx';

function GlobalQuickAddModal() {
  const [isOpen, setIsOpen] = useState(false);
  const addTrade = useJournalStore((s) => s.addTrade);

  // ── Instant trade from chart BUY/SELL buttons ───────────────
  useEffect(() => {
    const handleInstantTrade = (e) => {
      const { side, symbol, price, tf, qty, dollarAmount } = e.detail || {};
      if (!symbol) return;

      // Look up asset class from SymbolRegistry
      const info = SymbolRegistry.lookup(symbol);
      const assetClass = info?.assetClass || null;

      // Format price for display
      const fmtPrice =
        typeof price === 'number'
          ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })
          : '—';

      // Format qty and dollar for display
      const qtyVal = typeof qty === 'number' && qty > 0 ? qty : null;
      const dollarVal = typeof dollarAmount === 'number' && dollarAmount > 0 ? dollarAmount : null;

      // Build human-readable size string
      let sizeStr = '';
      if (qtyVal != null && dollarVal != null) {
        const dollarFmt = dollarVal >= 1000
          ? '$' + dollarVal.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : '$' + dollarVal.toFixed(2);
        sizeStr = ` ${dollarFmt} (x${qtyVal})`;
      } else if (qtyVal != null) {
        sizeStr = ` x${qtyVal}`;
      }

      // Capture chart screenshot before creating the trade
      const screenshot = captureChartScreenshot(symbol, tf);

      const trade = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString(),
        entryTime: Date.now(),
        symbol: symbol.toUpperCase(),
        side,
        entry: typeof price === 'number' ? price : null,
        qty: qtyVal,
        dollarAmount: dollarVal,
        pnl: 0,
        assetClass,
        source: 'chart-quick-trade',
        notes: `Quick ${side} from chart @ ${fmtPrice}${sizeStr} (${tf || '—'})`,
        ...(screenshot ? { screenshots: [screenshot] } : {}),
      };

      addTrade(trade);

      const label = side === 'long' ? 'BUY' : 'SELL';
      const snap = screenshot ? ' 📸' : '';
      toast.success(`⚡ ${label} ${symbol}${sizeStr} @ ${fmtPrice} journaled!${snap}`);
    };

    window.addEventListener('charEdge:instant-trade', handleInstantTrade);
    return () => window.removeEventListener('charEdge:instant-trade', handleInstantTrade);
  }, [addTrade]);

  // ── Manual quick-add modal (Command Palette, etc.) ──────────
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const _handleClose = () => setIsOpen(false);

    window.addEventListener('charEdge:global-quick-add', handleOpen);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('charEdge:global-quick-add', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSave = (trade) => {
    addTrade(trade);
    setIsOpen(false);
    toast.success('Trade quickly added!');
  };

  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
    }
  }, [isOpen]);

  const handleTransitionEnd = useCallback(
    (e) => {
      if (!isOpen && e.target === e.currentTarget) setMounted(false);
    },
    [isOpen],
  );

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 6000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          opacity: animating ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      />

      {/* Modal Content */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 700,
          padding: '0 20px',
          opacity: animating ? 1 : 0,
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <div
          style={{
            background: C.sf,
            borderRadius: 12,
            border: `1px solid ${C.bd}`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${C.bd}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>⚡ Global Quick-Add</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              Press{' '}
              <kbd style={{ padding: '2px 6px', background: C.bg2, borderRadius: 4, border: `1px solid ${C.bd}` }}>
                ESC
              </kbd>{' '}
              to close
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <JournalQuickAdd onSave={handleSave} onCancel={() => setIsOpen(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(GlobalQuickAddModal);
