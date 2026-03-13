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

import React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { C, F, M, GLASS, DEPTH } from '../../../constants.js';
import { useWatchlistStore, groupByAssetClass, buildFolderTree, getRootItems, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { alpha } from '@/shared/colorUtils';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';

// ─── Constants ──────────────────────────────────────────────────

const PANEL_WIDTH = 300;
const HANDLE_WIDTH = 22;
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
      style={{ width, height, display: 'block', borderRadius: 4 }}
    />
  );
}

// ─── Watchlist Quick Panel ──────────────────────────────────────

function WatchlistQuickPanel({ isOpen, onToggle, onClose, onSymbolSelect }) {
  const items = useWatchlistStore((s) => s.items);
  const addSymbol = useWatchlistStore((s) => s.add);
  const removeSymbol = useWatchlistStore((s) => s.remove);
  const trades = useJournalStore((s) => s.trades);
  const currentSymbol = useChartCoreStore((s) => s.symbol);

  const [filter, setFilter] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [tickers, setTickers] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [addInput, setAddInput] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const [viewMode, setViewMode] = useState('folders'); // 'folders' | 'asset'
  const filterRef = useRef(null);

  // Folder state
  const folders = useWatchlistStore((s) => s.folders);
  const addFolder = useWatchlistStore((s) => s.addFolder);
  const removeFolder = useWatchlistStore((s) => s.removeFolder);
  const renameFolder = useWatchlistStore((s) => s.renameFolder);
  const toggleFolderCollapse = useWatchlistStore((s) => s.toggleFolderCollapse);
  const moveToFolder = useWatchlistStore((s) => s.moveToFolder);
  const reorderStore = useWatchlistStore((s) => s.reorder);
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
      // delta > 0 means dragging left (opening), delta < 0 means dragging right (closing)
      if (dragStartRef.current.wasOpen) {
        // If already open, only track rightward drags for dismissal
        setDragOffset(Math.min(0, delta));
      } else {
        // If closed, track leftward drags to reveal
        setDragOffset(Math.max(0, delta));
      }
    };

    const handleUp = (upEvt) => {
      const delta = dragStartRef.current.startX - upEvt.clientX;
      setIsDragging(false);
      setDragOffset(0);

      if (dragStartRef.current.wasOpen) {
        // Was open — dismiss if dragged right enough
        if (-delta > DISMISS_THRESHOLD) {
          onClose?.();
        }
      } else {
        // Was closed — open if dragged left enough
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

  // Focus search on open
  useEffect(() => {
    if (isOpen && filterRef.current) {
      setTimeout(() => filterRef.current?.focus(), 250);
    }
  }, [isOpen]);

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
    return viewMode === 'asset' ? ri : ri;
  }, [filteredItems, viewMode]);
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
      // Drop onto a folder
      moveToFolder(dragItem.symbol, targetFolderId);
    } else if (dragItem.idx !== targetIdx) {
      // Reorder within same list
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
      // Clear after animation
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
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', cursor: 'grab',
          background: isActive
            ? alpha(C.b, 0.08)
            : isHovered ? alpha(C.sf2, 0.6) : 'transparent',
          borderLeft: isActive ? `2px solid ${C.b}` : '2px solid transparent',
          transition: 'all 0.12s ease',
          position: 'relative',
          opacity: dragItem?.symbol === item.symbol ? 0.4 : 1,
        }}
      >
        {/* Price flash overlay */}
        {flashSymbols[item.symbol] && (
          <div style={{
            position: 'absolute', inset: 0,
            background: flashSymbols[item.symbol] === 'up'
              ? alpha(C.g, 0.08)
              : alpha(C.r, 0.08),
            animation: 'priceFlash 0.6s ease-out',
            pointerEvents: 'none',
          }} />
        )}
        {/* Drag grip */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5, opacity: 0.3, cursor: 'grab' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', gap: 1.5 }}>
              <div style={{ width: 2, height: 2, borderRadius: 1, background: C.t3 }} />
              <div style={{ width: 2, height: 2, borderRadius: 1, background: C.t3 }} />
            </div>
          ))}
        </div>

        {/* Symbol + Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 12, fontWeight: isActive ? 800 : 700,
                color: isActive ? C.b : C.t1, fontFamily: M,
              }}
            >
              {item.symbol}
            </span>
            {item.tradeCount > 0 && (
              <span
                style={{
                  fontSize: 8, color: item.totalPnl >= 0 ? C.g : C.r,
                  fontFamily: M, fontWeight: 600,
                }}
              >
                {item.totalPnl >= 0 ? '+' : ''}${item.totalPnl.toFixed(0)}
              </span>
            )}
          </div>
          {item.name && item.name !== item.symbol && (
            <div
              style={{
                fontSize: 9, color: C.t3, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: F, marginTop: 1,
              }}
            >
              {item.name}
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparkline && sparkline.length > 0 && (
          <div style={{ flexShrink: 0, opacity: 0.85 }}>
            <MiniSparkline data={sparkline} color={changeColor} width={48} height={20} />
          </div>
        )}

        {/* Price + Change */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 56 }}>
          {lastPrice !== null && (
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: M, color: C.t1 }}>
              {lastPrice < 1 ? lastPrice.toFixed(4) : lastPrice < 100 ? lastPrice.toFixed(2) : lastPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          )}
          {changePercent !== null && (
            <div
              style={{
                fontSize: 9, fontWeight: 600, fontFamily: M, color: changeColor,
                background: alpha(changeColor, 0.08), padding: '1px 5px',
                borderRadius: 4, marginTop: 1, display: 'inline-block',
              }}
            >
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Remove button (hover only) */}
        {isHovered && !isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeSymbol(item.symbol);
            }}
            style={{
              position: 'absolute', right: 4, top: 4,
              width: 16, height: 16, borderRadius: 4, border: 'none',
              background: alpha(C.r, 0.1), color: C.r, fontSize: 9,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            title="Remove from watchlist"
          >
            ✕
          </button>
        )}
      </div>
    );
  }, [mergedTickers, sparklines, currentSymbol, hoveredSymbol, dragItem, flashSymbols, handleRowDragStart, handleRowDragOver, handleRowDrop, handleRowDragEnd, handleSymbolClick, removeSymbol]);

  // ─── Compute transform ────────────────────────────────────────
  // Panel is in the normal flow of the flex container.
  // When closed: translateX(100%) pushes it offscreen right.
  // When open: translateX(0) shows it.
  // During drag: interpolate based on dragOffset.

  let panelTranslateX;
  if (isDragging) {
    if (dragStartRef.current?.wasOpen) {
      // Open + dragging right to dismiss: translate by negative offset (rightward)
      panelTranslateX = Math.max(0, -dragOffset);
    } else {
      // Closed + dragging left to reveal: translate from full width minus offset
      panelTranslateX = Math.max(0, PANEL_WIDTH - dragOffset);
    }
  } else {
    panelTranslateX = isOpen ? 0 : PANEL_WIDTH;
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        width: isOpen && !isDragging ? PANEL_WIDTH : 0,
        minWidth: isOpen && !isDragging ? PANEL_WIDTH : 0,
        flexShrink: 0,
        transition: isDragging ? 'none' : 'width 0.35s cubic-bezier(0.32, 0.72, 0, 1), min-width 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        overflow: 'visible',
      }}
    >
      {/* ─── Drag Handle Tab (always visible on the right edge of chart area) ─── */}
      <div
        onMouseDown={handleDragStart}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        onClick={() => !isDragging && onToggle?.()}
        title={isOpen ? 'Drag right to close (W)' : 'Drag left to open watchlist (W)'}
        style={{
          position: 'absolute',
          top: '50%',
          left: isOpen ? -(HANDLE_WIDTH + 4) : -(HANDLE_WIDTH + 6),
          transform: 'translateY(-50%)',
          width: HANDLE_WIDTH + 4,
          height: 120,
          borderRadius: '10px 0 0 10px',
          background: handleHovered || isDragging
            ? alpha(C.b, 0.25)
            : isOpen
              ? alpha(C.sf2, 0.7)
              : alpha(C.b, 0.08),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1.5px solid ${alpha(C.b, handleHovered || isDragging ? 0.5 : 0.2)}`,
          borderRight: 'none',
          cursor: 'grab',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          zIndex: 20,
          transition: 'background 0.15s, border-color 0.15s, left 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.15s',
          userSelect: 'none',
          boxShadow: handleHovered || isDragging ? `0 0 12px ${alpha(C.b, 0.2)}` : 'none',
          animation: !isOpen && !handleHovered ? 'handlePulse 3s ease-in-out infinite' : 'none',
        }}
      >
        {/* Grip dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              background: handleHovered || isDragging ? C.b : alpha(C.b, 0.35),
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
        {/* Watchlist icon below dots */}
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none"
          stroke={handleHovered || isDragging ? C.b : alpha(C.b, 0.4)}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginTop: 3, transition: 'stroke 0.15s' }}
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {/* Chevron arrow hint */}
        <svg
          width="10" height="10" viewBox="0 0 24 24"
          fill="none"
          stroke={handleHovered || isDragging ? C.b : alpha(C.b, 0.3)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginTop: 2, transition: 'stroke 0.15s' }}
        >
          <polyline points={isOpen ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
        </svg>
      </div>

      {/* ─── Panel Body ────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          display: 'flex',
          flexDirection: 'column',
          background: GLASS.standard,
          backdropFilter: GLASS.blurMd,
          WebkitBackdropFilter: GLASS.blurMd,
          borderLeft: GLASS.border,
          boxShadow: isOpen ? DEPTH[2] : 'none',
          transform: `translateX(${panelTranslateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s ease',
          overflow: 'hidden',
          pointerEvents: panelTranslateX >= PANEL_WIDTH ? 'none' : 'auto',
        }}
      >
        {/* ─── Header ──────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderBottom: GLASS.border,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.b} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>Watchlist</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.b,
                background: alpha(C.b, 0.1),
                padding: '1px 6px',
                borderRadius: 4,
                fontFamily: M,
              }}
            >
              {items.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setShowAddInput(!showAddInput)}
              title="Add symbol"
              style={{
                width: 24, height: 24, borderRadius: 6, border: 'none',
                background: showAddInput ? alpha(C.b, 0.12) : 'transparent',
                color: showAddInput ? C.b : C.t3, fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              +
            </button>
            <button
              onClick={handleNewFolder}
              title="New folder"
              style={{
                width: 24, height: 24, borderRadius: 6, border: 'none',
                background: 'transparent', color: C.t3, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = alpha(C.t3, 0.08); }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              📁
            </button>
            <button
              onClick={() => onClose?.()}
              title="Slide away (W)"
              style={{
                width: 24, height: 24, borderRadius: 6, border: 'none',
                background: 'transparent', color: C.t3, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = alpha(C.t3, 0.1); }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── Add Symbol Input (toggled) ──────────────────── */}
        {showAddInput && (
          <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: GLASS.border, flexShrink: 0 }}>
            <input
              value={addInput}
              onChange={(e) => setAddInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
              placeholder="Add ticker..."
              autoFocus
              style={{
                flex: 1, background: alpha(C.sf, 0.6), border: `1px solid ${C.bd}`,
                borderRadius: 6, padding: '5px 10px', fontSize: 12, fontFamily: M,
                fontWeight: 600, color: C.t1, outline: 'none',
              }}
            />
            <button
              onClick={handleAddSymbol}
              disabled={!addInput.trim()}
              style={{
                background: C.b, border: 'none', borderRadius: 6, color: '#fff',
                fontSize: 11, fontWeight: 700, padding: '5px 12px',
                cursor: addInput.trim() ? 'pointer' : 'default',
                opacity: addInput.trim() ? 1 : 0.4,
                transition: 'opacity 0.15s',
              }}
            >
              Add
            </button>
          </div>
        )}

        {/* ─── Search Filter ──────────────────────────────── */}
        <div style={{ padding: '6px 12px', flexShrink: 0 }}>
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="🔍 Filter symbols..."
            style={{
              width: '100%', background: alpha(C.sf, 0.4),
              border: `1px solid ${alpha(C.bd, 0.5)}`, borderRadius: 8,
              padding: '6px 10px', fontSize: 11, fontFamily: F, color: C.t1, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = alpha(C.b, 0.4); }}
            onBlur={(e) => { e.target.style.borderColor = alpha(C.bd, 0.5); }}
          />
        </div>

        {/* ─── Symbol List ────────────────────────────────── */}
        <div
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            scrollbarWidth: 'thin', scrollbarColor: `${C.bd} transparent`,
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.t3, fontSize: 11, fontFamily: F }}>
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
                    style={{
                      padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
                      cursor: 'pointer', userSelect: 'none',
                      background: alpha(C.sf2, 0.3),
                      borderBottom: `1px solid ${alpha(C.bd, 0.2)}`,
                    }}
                    onClick={() => toggleFolderCollapse(folder.id)}
                  >
                    <span style={{ fontSize: 8, color: C.t3, transition: 'transform 0.15s', transform: folder.collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>▼</span>
                    <span style={{ fontSize: 12 }}>{folder.color ? '' : '📁'}</span>
                    {renamingFolder === folder.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => { renameFolder(folder.id, renameValue || 'Folder'); setRenamingFolder(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { renameFolder(folder.id, renameValue || 'Folder'); setRenamingFolder(null); } }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1,
                          background: alpha(C.sf, 0.6), border: `1px solid ${C.b}`,
                          borderRadius: 4, padding: '1px 6px', outline: 'none', width: 100,
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: F, color: C.t1, flex: 1 }}>
                        {folder.name}
                      </span>
                    )}
                    <span style={{ fontSize: 8, fontFamily: M, color: C.t3 }}>({folderItems.length})</span>
                    {/* Folder actions */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder.id); setRenameValue(folder.name); }}
                      title="Rename"
                      style={{ background: 'none', border: 'none', color: C.t3, fontSize: 9, cursor: 'pointer', padding: '0 2px', opacity: 0.5 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                    >✏️</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                      title="Delete folder"
                      style={{ background: 'none', border: 'none', color: C.t3, fontSize: 9, cursor: 'pointer', padding: '0 2px', opacity: 0.5 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                    >🗑️</button>
                  </div>
                  {/* Folder items */}
                  {!folder.collapsed && folderItems.map((item, idx) => renderSymbolRow(item, idx))}
                </div>
              ))}

              {/* ─── Root items (no folder) grouped by asset class ─── */}
              {Array.from(rootGrouped.entries()).map(([assetClass, groupItems]) => (
                <div key={assetClass}>
                  {/* Group header */}
                  <div
                    style={{
                      padding: '8px 12px 3px', fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: C.t3, fontFamily: F, display: 'flex',
                      alignItems: 'center', gap: 4,
                    }}
                  >
                    <span>{ASSET_ICONS[assetClass] || '📋'}</span>
                    <span>{assetClass}</span>
                    <span style={{ fontFamily: M, fontSize: 8, color: alpha(C.t3, 0.6) }}>
                      ({groupItems.length})
                    </span>
                  </div>
                  {/* Symbols */}
                  {groupItems.map((item, idx) => renderSymbolRow(item, idx))}
                </div>
              ))}
            </>
          )}
        </div>

        {/* ─── Footer ────────────────────────────────────── */}
        <div
          style={{
            padding: '6px 12px', borderTop: GLASS.border,
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: C.t3, fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* WS status dot */}
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: wsStatus === 'connected' ? C.g : wsStatus === 'connecting' || wsStatus === 'reconnecting' ? '#f0b64e' : C.r,
              display: 'inline-block',
              animation: wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'pulse 1s infinite' : 'none',
            }} />
            Press <kbd style={{
              fontSize: 8, fontFamily: M,
              background: alpha(C.sf2, 0.8), padding: '1px 4px',
              borderRadius: 3, border: `1px solid ${alpha(C.bd, 0.5)}`,
            }}>W</kbd> to toggle · {wsStatus === 'connected' ? 'live' : wsStatus}
          </span>
          <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
            {filteredItems.length} symbols
          </span>
        </div>

        {/* CSS keyframes for flash + pulse */}
        <style>{`
          @keyframes priceFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @keyframes handlePulse {
            0%, 100% { opacity: 0.85; }
            50% { opacity: 1; border-color: rgba(var(--brand-rgb, 100, 200, 180), 0.35); }
          }
        `}</style>
      </div>
    </div>
  );
}

export { WatchlistQuickPanel };
export default React.memo(WatchlistQuickPanel);
