// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Quick Panel (A++ Tier)
//
// Right-side drag-to-reveal panel on the Charts page.
// A small grab tab sits on the right edge — drag it left to open,
// drag right (or click away / press Escape) to slide it offscreen.
// Stays pinned when open via isOpen prop; supports W shortcut toggle.
//
// UX:
//   - Closed: 6px drag handle visible on right edge
//   - Dragging: panel follows finger/mouse with spring physics
//   - Open: 300px glassmorphic panel with watchlist, prices, sparklines
//   - Dismiss: drag right past threshold, or press Escape / W
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense } from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore, groupByAssetClass, buildFolderTree, getRootItems, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import s from './WatchlistQuickPanel.module.css';

// Lazy-load AI Copilot for the AI tab
const CopilotChatInline = React.lazy(() => import('../ai/CopilotChatInline.jsx'));

// ─── Constants ──────────────────────────────────────────────────

const PANEL_WIDTH = 300;
const DISMISS_THRESHOLD = 120; // drag right px to dismiss

const ASSET_ICONS = {
  futures: '📊',
  stocks: '📈',
  crypto: '₿',
  etf: '🏦',
  forex: '💱',
  options: '⚡',
  other: '📋',
};

// ─── Mini Sparkline (Canvas-based for performance) ──────────────

function MiniSparkline({ data, color, width = 60, height = 24 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * width;
      const y = pad + (1 - (data[i] - min) / range) * (height - pad * 2);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * width;
      const y = pad + (1 - (data[i] - min) / range) * (height - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [data, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={s.sparklineCanvas}
      style={{ width, height }}
    />
  );
}

// ─── Watchlist Quick Panel ──────────────────────────────────────

function WatchlistQuickPanel({ isOpen, onToggle, onClose, onSymbolSelect, initialTab }) {
  const items = useWatchlistStore((st) => st.items);
  const addSymbol = useWatchlistStore((st) => st.add);
  const removeSymbol = useWatchlistStore((st) => st.remove);
  const trades = useJournalStore((st) => st.trades);
  const currentSymbol = useChartCoreStore((st) => st.symbol);

  const [filter, setFilter] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [tickers, setTickers] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [addInput, setAddInput] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [viewMode, setViewMode] = useState('standard'); // 'compact' | 'standard' | 'table'
  const [groupMode, setGroupMode] = useState('folders'); // 'folders' | 'asset'
  const filterRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'watchlist'); // 'watchlist' | 'copilot'

  // Folder state
  const folders = useWatchlistStore((st) => st.folders);
  const addFolder = useWatchlistStore((st) => st.addFolder);
  const addSmartFolder = useWatchlistStore((st) => st.addSmartFolder);
  const removeFolder = useWatchlistStore((st) => st.removeFolder);
  const renameFolder = useWatchlistStore((st) => st.renameFolder);
  const toggleFolderCollapse = useWatchlistStore((st) => st.toggleFolderCollapse);
  const moveToFolder = useWatchlistStore((st) => st.moveToFolder);
  const reorderStore = useWatchlistStore((st) => st.reorder);
  const [showSmartPresets, setShowSmartPresets] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragItem, setDragItem] = useState(null);
  const [flashSymbols, setFlashSymbols] = useState({}); // { sym: 'up'|'down' }
  const prevPricesRef = useRef({});

  // ─── WebSocket streaming ──────────────────────────────────────
  const symbolList = useMemo(() => items.map(i => i.symbol), [items]);
  const { prices: streamingPrices, wsStatus } = useWatchlistStreaming(symbolList, isOpen);

  // ─── Drag state ───────────────────────────────────────────────
  const [dragOffset, setDragOffset] = useState(0); // px dragged from edge
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { startX: e.clientX, wasOpen: isOpen };

    const handleMove = (moveEvt) => {
      const delta = dragStartRef.current.startX - moveEvt.clientX;
      if (dragStartRef.current.wasOpen) {
        setDragOffset(Math.min(0, delta));
      } else {
        setDragOffset(Math.max(0, delta));
      }
    };

    const handleUp = (upEvt) => {
      const delta = dragStartRef.current.startX - upEvt.clientX;
      setIsDragging(false);
      setDragOffset(0);

      if (dragStartRef.current.wasOpen) {
        if (-delta > DISMISS_THRESHOLD) {
          onClose?.();
        }
      } else {
        if (delta > DISMISS_THRESHOLD / 2) {
          onToggle?.();
        }
      }

      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [isOpen, onClose, onToggle]);

  // Fetch tickers and sparklines for watchlist items
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    let mounted = true;

    import('../../../data/FetchService').then(async ({ fetch24hTicker, fetchSparkline }) => {
      // Batch fetch tickers
      const symbolsToFetch = items.filter(i => !tickers[i.symbol]).map(i => i.symbol);
      if (symbolsToFetch.length > 0) {
        const tickerResults = await fetch24hTicker(symbolsToFetch);
        const newTickers = { ...tickers };
        for (const t of tickerResults) {
          if (t?.symbol) {
            newTickers[t.symbol.replace('USDT', '')] = t;
            newTickers[t.symbol] = t;
          }
        }
        if (mounted) setTickers(newTickers);
      }

      // Batch fetch sparklines via QuoteService
      const { batchGetQuotes } = await import('../../../data/QuoteService.js');
      const missingSparklines = items.filter(i => !sparklines[i.symbol]).map(i => i.symbol);
      if (missingSparklines.length > 0) {
        const quoteMap = await batchGetQuotes(missingSparklines);
        const newSparklines = { ...sparklines };
        const stillMissing = [];
        for (const sym of missingSparklines) {
          const quote = quoteMap.get(sym.toUpperCase());
          if (quote?.sparkline?.length > 0) {
            newSparklines[sym] = quote.sparkline;
          } else {
            stillMissing.push(sym);
          }
        }
        if (stillMissing.length > 0) {
          const sparkPromises = stillMissing.map(async (sym) => {
            const item = items.find(i => i.symbol === sym);
            const sData = await fetchSparkline(sym, item?.assetClass === 'crypto');
            return { symbol: sym, data: sData };
          });
          const sparkResults = await Promise.all(sparkPromises);
          for (const { symbol, data } of sparkResults) {
            if (data && data.length > 0) newSparklines[symbol] = data;
          }
        }
        if (mounted) setSparklines(newSparklines);
      }
    });

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items]);

  // Focus search on open (only for watchlist tab)
  useEffect(() => {
    if (isOpen && activeTab === 'watchlist' && filterRef.current) {
      setTimeout(() => filterRef.current?.focus(), 250);
    }
  }, [isOpen, activeTab]);

  // Sync initialTab prop
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Listen for external event to switch to AI tab (Cmd+K)
  useEffect(() => {
    const handler = () => {
      setActiveTab('copilot');
    };
    window.addEventListener('charEdge:open-copilot-tab', handler);
    return () => window.removeEventListener('charEdge:open-copilot-tab', handler);
  }, []);

  // Enrich with trade stats
  const processedItems = useMemo(() => enrichWithTradeStats(items, trades), [items, trades]);

  // Filter
  const filteredItems = useMemo(() => {
    if (!filter) return processedItems;
    const q = filter.toLowerCase();
    return processedItems.filter(
      (i) => i.symbol.toLowerCase().includes(q) || (i.name && i.name.toLowerCase().includes(q)),
    );
  }, [processedItems, filter]);

  // Build folder tree for rendering
  const folderTree = useMemo(() => buildFolderTree(filteredItems, folders), [filteredItems, folders]);
  const rootItems = useMemo(() => {
    const ri = getRootItems(filteredItems);
    return groupMode === 'asset' ? ri : ri;
  }, [filteredItems, groupMode]);
  const rootGrouped = useMemo(() => groupByAssetClass(rootItems), [rootItems]);

  const handleSymbolClick = useCallback(
    (symbol) => {
      onSymbolSelect?.(symbol);
    },
    [onSymbolSelect],
  );

  const handleAddSymbol = useCallback(() => {
    const sym = addInput.trim().toUpperCase();
    if (sym) {
      addSymbol({ symbol: sym });
      setAddInput('');
      setShowAddInput(false);
    }
  }, [addInput, addSymbol]);

  const handleNewFolder = useCallback(() => {
    const id = addFolder('New Folder');
    setRenamingFolder(id);
    setRenameValue('New Folder');
  }, [addFolder]);

  // ─── DnD handlers for reordering ──────────────────────────────
  const handleRowDragStart = useCallback((e, symbol, idx) => {
    setDragItem({ symbol, idx });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', symbol);
  }, []);

  const handleRowDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRowDrop = useCallback((e, targetIdx, targetFolderId = null) => {
    e.preventDefault();
    if (!dragItem) return;
    if (targetFolderId !== undefined) {
      moveToFolder(dragItem.symbol, targetFolderId);
    } else if (dragItem.idx !== targetIdx) {
      reorderStore(dragItem.idx, targetIdx);
    }
    setDragItem(null);
  }, [dragItem, moveToFolder, reorderStore]);

  const handleRowDragEnd = useCallback(() => {
    setDragItem(null);
  }, []);

  // ─── Merge streaming + REST prices ────────────────────────────
  const mergedTickers = useMemo(() => {
    const merged = { ...tickers };
    for (const [sym, data] of Object.entries(streamingPrices)) {
      if (data.price) {
        merged[sym] = {
          ...merged[sym],
          lastPrice: String(data.price),
          priceChangePercent: data.changePercent != null ? String(data.changePercent) : merged[sym]?.priceChangePercent,
          priceChange: data.change != null ? String(data.change) : merged[sym]?.priceChange,
          volume: data.volume != null ? String(data.volume) : merged[sym]?.volume,
          _live: true,
        };
      }
    }
    return merged;
  }, [tickers, streamingPrices]);

  // ─── Price flash animation ────────────────────────────────────
  useEffect(() => {
    const flashes = {};
    for (const [sym, data] of Object.entries(mergedTickers)) {
      const price = parseFloat(data?.lastPrice);
      const prev = prevPricesRef.current[sym];
      if (prev && price && price !== prev) {
        flashes[sym] = price > prev ? 'up' : 'down';
      }
      if (price) prevPricesRef.current[sym] = price;
    }
    if (Object.keys(flashes).length > 0) {
      setFlashSymbols(flashes);
      const t = setTimeout(() => setFlashSymbols({}), 600);
      return () => clearTimeout(t);
    }
  }, [mergedTickers]);

  // ─── Render a single symbol row (shared by folders + root) ────
  const renderSymbolRow = useCallback((item, idx) => {
    const ticker = mergedTickers[item.symbol];
    const sparkline = sparklines[item.symbol];
    const isActive = currentSymbol?.toUpperCase() === item.symbol.toUpperCase();
    const isHovered = hoveredSymbol === item.symbol;
    const changePercent = ticker ? parseFloat(ticker.priceChangePercent) : null;
    const isPositive = changePercent !== null ? changePercent >= 0 : true;
    const changeColor = changePercent !== null ? (isPositive ? C.g : C.r) : C.t3;
    const lastPrice = ticker ? parseFloat(ticker.lastPrice) : null;

    const isCompact = viewMode === 'compact';
    const isTable = viewMode === 'table';
    const showSparkline = !isCompact;
    const showName = !isCompact && !isTable;

    return (
      <div
        key={item.symbol}
        draggable
        onDragStart={(e) => handleRowDragStart(e, item.symbol, idx)}
        onDragOver={handleRowDragOver}
        onDrop={(e) => handleRowDrop(e, idx)}
        onDragEnd={handleRowDragEnd}
        onClick={() => handleSymbolClick(item.symbol)}
        onMouseEnter={() => setHoveredSymbol(item.symbol)}
        onMouseLeave={() => setHoveredSymbol(null)}
        className={s.symbolRow}
        data-compact={isCompact || undefined}
        data-table={isTable || undefined}
        data-active={isActive || undefined}
        data-dragging={dragItem?.symbol === item.symbol || undefined}
      >
        {/* Price flash overlay */}
        {flashSymbols[item.symbol] && (
          <div className={s.priceFlash} data-dir={flashSymbols[item.symbol]} />
        )}
        {/* Drag grip (hidden in compact) */}
        {!isCompact && (
          <div className={s.dragGrip}>
            {[0, 1].map(i => (
              <div key={i} className={s.dragGripRow}>
                <div className={s.dragGripDot} />
                <div className={s.dragGripDot} />
              </div>
            ))}
          </div>
        )}

        {/* Symbol + Name */}
        <div className={s.symbolInfo}>
          <div className={s.symbolNameRow}>
            <span className={s.symbolTicker}>
              {item.symbol}
            </span>
            {item.tradeCount > 0 && !isCompact && (
              <span className={s.tradeStats} style={{ '--stat-color': item.totalPnl >= 0 ? C.g : C.r }}>
                {item.totalPnl >= 0 ? '+' : ''}${item.totalPnl.toFixed(0)}
              </span>
            )}
          </div>
          {showName && item.name && item.name !== item.symbol && (
            <div className={s.symbolName}>
              {item.name}
            </div>
          )}
        </div>

        {/* Sparkline (standard + table only) */}
        {showSparkline && sparkline && sparkline.length > 0 && (
          <div className={s.sparklineWrap}>
            <MiniSparkline data={sparkline} color={changeColor} width={isTable ? 64 : 48} height={isTable ? 18 : 20} />
          </div>
        )}

        {/* Price + Change */}
        <div className={s.priceCol}>
          {lastPrice !== null && (
            <div className={s.priceValue}>
              {lastPrice < 1 ? lastPrice.toFixed(4) : lastPrice < 100 ? lastPrice.toFixed(2) : lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          )}
          {changePercent !== null && (
            <div
              className={s.changeBadge}
              style={{ '--change-color': changeColor, '--change-bg': changeColor + '14' }}
            >
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Volume column (table only) */}
        {isTable && (
          <div className={s.volumeCol}>
            {ticker?.volume ? (
              <span className={s.volumeVal}>
                {parseFloat(ticker.volume) >= 1e6
                  ? `${(parseFloat(ticker.volume) / 1e6).toFixed(1)}M`
                  : parseFloat(ticker.volume) >= 1e3
                    ? `${(parseFloat(ticker.volume) / 1e3).toFixed(0)}K`
                    : parseFloat(ticker.volume).toFixed(0)}
              </span>
            ) : (
              <span className={s.volumeEmpty}>—</span>
            )}
          </div>
        )}

        {/* Remove button (hover only) */}
        {isHovered && !isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeSymbol(item.symbol);
            }}
            className={s.removeBtn}
            title="Remove from watchlist"
          >
            ✕
          </button>
        )}
      </div>
    );
  }, [mergedTickers, sparklines, currentSymbol, hoveredSymbol, dragItem, flashSymbols, viewMode, handleRowDragStart, handleRowDragOver, handleRowDrop, handleRowDragEnd, handleSymbolClick, removeSymbol]);

  // ─── Compute transform ────────────────────────────────────────
  let panelTranslateX;
  if (isDragging) {
    if (dragStartRef.current?.wasOpen) {
      panelTranslateX = Math.max(0, -dragOffset);
    } else {
      panelTranslateX = Math.max(0, PANEL_WIDTH - dragOffset);
    }
  } else {
    panelTranslateX = isOpen ? 0 : PANEL_WIDTH;
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div
      className={s.wrapper}
      data-open={isOpen && !isDragging}
      data-dragging={isDragging || undefined}
    >
      {/* ─── Drag Handle Tab ─── */}
      <div
        onMouseDown={handleDragStart}
        onClick={() => !isDragging && onToggle?.()}
        title={isOpen ? 'Drag right to close (W)' : 'Drag left to open watchlist (W)'}
        className={s.handle}
        data-open={isOpen}
        data-active={isDragging || undefined}
      >
        {/* Grip dots */}
        <div className={s.handleDots}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={s.gripDot} />
          ))}
        </div>
        {/* Tab icon below dots */}
        {activeTab === 'copilot' ? (
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={s.handleIcon}
          >
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
          </svg>
        ) : (
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={s.handleIcon}
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
        {/* Chevron arrow hint */}
        <svg
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={s.handleChevron}
        >
          <polyline points={isOpen ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
        </svg>
      </div>

      {/* ─── Panel Body ─── */}
      <div
        className={s.panelBody}
        data-dragging={isDragging || undefined}
        style={{
          boxShadow: isOpen ? 'var(--tf-shadow-2)' : 'none',
          transform: `translateX(${panelTranslateX}px)`,
          pointerEvents: panelTranslateX >= PANEL_WIDTH ? 'none' : 'auto',
        }}
      >
        {/* ─── Tab Bar ─── */}
        <div className={s.tabBar}>
          <div className={s.tabList}>
            {[
              { id: 'watchlist', label: 'Watchlist', icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ), badge: items.length },
              { id: 'copilot', label: 'AI Copilot', icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor" fillOpacity="0.15" />
                </svg>
              ) },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={s.tabBtn}
                data-active={activeTab === tab.id || undefined}
              >
                <span className={s.tabIcon}>{tab.icon}</span>
                {tab.label}
                {tab.badge != null && (
                  <span className={s.tabBadge}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={() => onClose?.()}
            title="Slide away (W)"
            className={s.closeBtn}
          >
            ✕
          </button>
        </div>

        {/* ─── Watchlist Header Controls ─── */}
        {activeTab === 'watchlist' && (
          <div className={s.headerControls}>
            {/* View mode toggle */}
            <div className={s.viewModeGroup}>
              {[['compact', '☰'], ['standard', '≡'], ['table', '▤']].map(([mode, icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
                  className={s.viewModeBtn}
                  data-active={viewMode === mode || undefined}
                >
                  {icon}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddInput(!showAddInput)}
              title="Add symbol"
              className={`${s.iconBtn} ${s.addBtn}`}
              data-active={showAddInput || undefined}
            >
              +
            </button>
            <button
              onClick={handleNewFolder}
              title="New folder"
              className={`${s.iconBtn} ${s.folderBtn}`}
            >
              📁
            </button>
            {/* Smart folder button */}
            <div className={s.smartFolderWrap}>
              <button
                onClick={() => setShowSmartPresets(!showSmartPresets)}
                title="Create smart folder"
                className={`${s.iconBtn} ${s.smartBtn}`}
                data-active={showSmartPresets || undefined}
              >
                ⚡
              </button>
              {/* Smart folder preset dropdown */}
              {showSmartPresets && (
                <div className={s.smartDropdown}>
                  <div className={s.smartDropdownLabel}>Smart Folders</div>
                  {[
                    { name: '🔥 Movers > 3%', rules: [{ field: 'changePercent', op: '>=', value: 3 }] },
                    { name: '📉 Oversold', rules: [{ field: 'rsi', op: '<=', value: 30 }] },
                    { name: '₿ Crypto Only', rules: [{ field: 'assetClass', op: '==', value: 'crypto' }] },
                    { name: '📊 High Volume', rules: [{ field: 'volume', op: '>=', value: 1000000 }] },
                    { name: '🔻 Losers > -2%', rules: [{ field: 'changePercent', op: '<=', value: -2 }] },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        addSmartFolder(preset.name, preset.rules);
                        setShowSmartPresets(false);
                      }}
                      className={s.smartPresetBtn}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── WATCHLIST TAB CONTENT ─── */}
        {activeTab === 'watchlist' && (
          <>
            {/* ─── Add Symbol Input ─── */}
            {showAddInput && (
              <div className={s.addRow}>
                <input
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  placeholder="Add ticker..."
                  autoFocus
                  className={s.addInput}
                />
                <button
                  onClick={handleAddSymbol}
                  disabled={!addInput.trim()}
                  className={s.addSubmitBtn}
                >
                  Add
                </button>
              </div>
            )}

            {/* ─── Search Filter ─── */}
            <div className={s.filterWrap}>
              <input
                ref={filterRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="🔍 Filter symbols..."
                className={s.filterInput}
              />
            </div>

            {/* ─── Table Header (table mode only) ─── */}
            {viewMode === 'table' && filteredItems.length > 0 && (
              <div className={s.tableHeader}>
                <div className={`${s.tableHeaderCol} ${s['tableHeaderCol--symbol']}`}>Symbol</div>
                <div className={`${s.tableHeaderCol} ${s['tableHeaderCol--chart']}`}>Chart</div>
                <div className={`${s.tableHeaderCol} ${s['tableHeaderCol--price']}`}>Price</div>
                <div className={`${s.tableHeaderCol} ${s['tableHeaderCol--vol']}`}>Volume</div>
              </div>
            )}

            {/* ─── Symbol List ─── */}
            <div className={s.symbolList}>
              {filteredItems.length === 0 ? (
                <div className={s.emptyState}>
                  {filter ? 'No matching symbols' : 'Watchlist is empty'}
                </div>
              ) : (
                <>
                  {/* ─── Folders ─── */}
                  {folderTree.map(({ folder, items: folderItems, children }) => (
                    <div
                      key={folder.id}
                      onDragOver={handleRowDragOver}
                      onDrop={(e) => handleRowDrop(e, null, folder.id)}
                    >
                      {/* Folder header */}
                      <div
                        className={s.folderHeader}
                        onClick={() => toggleFolderCollapse(folder.id)}
                      >
                        <span className={s.folderChevron} data-collapsed={folder.collapsed || undefined}>▼</span>
                        <span className={s.folderIcon}>{folder.color ? '' : '📁'}</span>
                        {renamingFolder === folder.id ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => { renameFolder(folder.id, renameValue || 'Folder'); setRenamingFolder(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { renameFolder(folder.id, renameValue || 'Folder'); setRenamingFolder(null); } }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            className={s.folderRenameInput}
                          />
                        ) : (
                          <span className={s.folderName}>{folder.name}</span>
                        )}
                        <span className={s.folderCount}>({folderItems.length})</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder.id); setRenameValue(folder.name); }}
                          title="Rename"
                          className={s.folderAction}
                        >✏️</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                          title="Delete folder"
                          className={s.folderAction}
                        >🗑️</button>
                      </div>
                      {/* Folder items */}
                      {!folder.collapsed && folderItems.map((item, idx) => renderSymbolRow(item, idx))}
                    </div>
                  ))}

                  {/* ─── Root items grouped by asset class ─── */}
                  {Array.from(rootGrouped.entries()).map(([assetClass, groupItems]) => (
                    <div key={assetClass}>
                      <div className={s.groupHeader}>
                        <span>{ASSET_ICONS[assetClass] || '📋'}</span>
                        <span>{assetClass}</span>
                        <span className={s.groupCount}>({groupItems.length})</span>
                      </div>
                      {groupItems.map((item, idx) => renderSymbolRow(item, idx))}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ─── Footer ─── */}
            <div className={s.footer}>
              <span className={s.footerInfo}>
                <span className={s.wsDot} data-status={wsStatus} />
                Press <kbd className={s.kbd}>W</kbd> to toggle · {wsStatus === 'connected' ? 'live' : wsStatus}
              </span>
              <span className={s.footerCount}>
                {filteredItems.length} symbols
              </span>
            </div>
          </>
        )}

        {/* ─── AI COPILOT TAB CONTENT ─── */}
        {activeTab === 'copilot' && (
          <div className={s.copilotWrap}>
            <Suspense fallback={
              <div className={s.copilotLoading}>
                Loading AI Copilot…
              </div>
            }>
              <CopilotChatInline />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export { WatchlistQuickPanel };
export default React.memo(WatchlistQuickPanel);
