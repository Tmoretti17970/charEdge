// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Chart Toolbar (Decomposed)
// Thin composition layer that imports sub-components:
//   - ChartTypeSelector (chart type picker + preview)
//   - ToolbarMoreMenu (≡ menu with all categorized items)
//   - TimeframeCapsule (animated TF pills)
//   - WorkspacePresets (lazy-loaded)
// Drawing tools are handled by DrawingToolSelector dropdown.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo, Suspense } from 'react';
import { C, TFS } from '../../../constants.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import ChartTypeSelector from './toolbar/ChartTypeSelector.jsx';
import DrawingToolSelector from './toolbar/DrawingToolSelector.jsx';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useBreakpoints } from '@/hooks/useMediaQuery';
import { useAccountStore, ACCOUNTS } from '@/state/useAccountStore';
import { SymbolRegistry } from '../../../data/SymbolRegistry.js';
import {
  dollarToQty, qtyToDollar, getQtyLabel, formatQty, formatDollar,
  getUsdStep, getQtyStep, getQtyPrecision,
} from '../../../utils/positionSizeUtils.js';

// Extracted sub-components


// Lazy-load CommandCenterMenu to prevent chunk evaluation order issues
const CommandCenterMenu = React.lazy(() => import('./toolbar/CommandCenterMenu.jsx'));

// Lazy-load symbol search modal
const SymbolSearchModal = React.lazy(() => import('./panels/SymbolSearchModal.jsx'));

// Lazy-loaded new panels
const CustomTimeframeInput = React.lazy(() => import('./ui/CustomTimeframeInput.jsx'));

// Sprint 9: Workspace presets
const WorkspacePresets = React.lazy(() => import('./panels/WorkspacePresets.jsx'));

// ─── Tiny UI Helpers ──────────────────────────────────────────────
function ToolbarBtn({ children, active, onClick, disabled, title, style, 'aria-label': ariaLabel }) {
  return (
    <button
      className="tf-chart-toolbar-btn"
      data-active={active || undefined}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="tf-chart-divider" />;
}

// ─── Animated Capsule Timeframe Selector ──────────────────────────
function TimeframeCapsule({ tf, setTf, showCustomTf, toggleCustomTf }) {
  const groupRef = useRef(null);
  const pillRefs = useRef({});
  const [capsule, setCapsule] = useState({ left: 0, width: 0, ready: false });
  const customTfRef = useRef(null);

  // Measure the active pill and position the capsule
  const updateCapsule = useCallback(() => {
    const container = groupRef.current;
    const activePill = pillRefs.current[tf];
    if (!container || !activePill) return;
    const cRect = container.getBoundingClientRect();
    const pRect = activePill.getBoundingClientRect();
    setCapsule({
      left: pRect.left - cRect.left,
      width: pRect.width,
      ready: true,
    });
  }, [tf]);

  useLayoutEffect(() => {
    updateCapsule();
  }, [updateCapsule]);

  useEffect(() => {
    window.addEventListener('resize', updateCapsule);
    return () => window.removeEventListener('resize', updateCapsule);
  }, [updateCapsule]);

  return (
    <div className="tf-chart-tf-group" ref={groupRef} style={{ position: 'relative' }}>
      {/* Animated capsule background */}
      {capsule.ready && (
        <div
          className="tf-capsule-slider"
          style={{
            position: 'absolute',
            top: 3,
            left: capsule.left,
            width: capsule.width,
            height: 'calc(100% - 6px)',
            borderRadius: 7,
            background: `rgba(232, 100, 44, 0.15)`,
            boxShadow: `0 1px 3px rgba(0,0,0,0.2), inset 0 0 8px rgba(232,100,44,0.05)`,
            transition: 'left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {TFS.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            pillRefs.current[t.id] = el;
          }}
          className="tf-chart-tf-pill"
          data-active={tf === t.id || undefined}
          onClick={() => setTf(t.id)}
          style={{ position: 'relative', zIndex: 1 }}
        >
          {t.label}
        </button>
      ))}
      {/* Custom Timeframe */}
      <div ref={customTfRef} style={{ position: 'relative', zIndex: 1 }}>
        <button
          className="tf-chart-tf-pill"
          data-active={showCustomTf || undefined}
          onClick={toggleCustomTf}
          title="Custom Timeframe"
          style={{ fontSize: 11 }}
        >
          +
        </button>
        {showCustomTf && (
          <Suspense fallback={null}>
            <CustomTimeframeInput onClose={toggleCustomTf} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Unified Toolbar Component ────────────────────────────────────

export default function UnifiedChartToolbar({
  symbol,
  setSymbolInput,
  onSearchSelect,

  showIndicators,
  setShowIndicators,
  showObjectTree,
  setShowObjectTree,
  showTrades,
  setShowTrades,
  _matchingTradesCount,
  fetchSymbolSearch,
  onOpenPanel, // new prop to handle opening secondary panels in SlidePanel
  _onOpenCopilot, // Phase 2 AI
  onSnapshot, // Snapshot callback
  // Data source props for badge
  isLive: _isLive,
  wsSupported: _wsSupported,
  wsStatus: _wsStatus,
  dataSource: _dataSource,
  dataLoading: _dataLoading,
  // Layout
  layoutMode,
  setLayoutMode,
  // Batch 2: AI Analysis
  onToggleAnalysis,

}) {
  const { isMobile } = useBreakpoints();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [drawSelectorOpen, setDrawSelectorOpen] = useState(false);
  const drawBtnRef = useRef(null);
  const storeActiveTool = useChartToolsStore((s) => s.activeTool);
  const setActiveTool = useChartToolsStore((s) => s.setActiveTool);

  // ── Smart Position Sizer State ──────────────────────────────
  const [sizeMode, setSizeMode] = useState('qty'); // 'qty' or 'usd'
  const [sizeValue, setSizeValue] = useState(1);
  const livePrice = useChartCoreStore((s) => s.aggregatedPrice);

  // Asset class info for current symbol
  const symbolInfo = useMemo(() => SymbolRegistry.lookup(symbol), [symbol]);
  const assetClass = symbolInfo?.assetClass || 'crypto';
  const qtyLabel = useMemo(() => getQtyLabel(assetClass, symbol), [assetClass, symbol]);

  // Compute both qty & dollar from current mode + live price
  const { resolvedQty, resolvedDollar } = useMemo(() => {
    const price = livePrice || 0;
    if (sizeMode === 'usd') {
      return {
        resolvedQty: price > 0 ? dollarToQty(sizeValue || 0, price, assetClass) : 0,
        resolvedDollar: sizeValue || 0,
      };
    }
    return {
      resolvedQty: sizeValue || 0,
      resolvedDollar: price > 0 ? qtyToDollar(sizeValue || 0, price) : 0,
    };
  }, [sizeMode, sizeValue, livePrice, assetClass]);

  // Toggle mode — convert current value to the other unit
  const toggleSizeMode = useCallback(() => {
    setSizeMode((prev) => {
      const next = prev === 'qty' ? 'usd' : 'qty';
      // Convert current value to the other unit
      const price = useChartCoreStore.getState().aggregatedPrice || 0;
      if (price > 0) {
        if (next === 'usd') {
          setSizeValue(+qtyToDollar(sizeValue || 0, price).toFixed(2));
        } else {
          const raw = dollarToQty(sizeValue || 0, price, assetClass);
          setSizeValue(raw);
        }
      }
      return next;
    });
  }, [sizeValue, assetClass]);

  // Account store (must be at component level, not inside callbacks)
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const toggleAccount = useAccountStore((s) => s.toggleAccount);

  // Helper: dispatch instant-trade event with full chart context
  const dispatchInstantTrade = useCallback(
    (side) => {
      const state = useChartCoreStore.getState();
      const accountId = useAccountStore.getState().activeAccountId;
      window.dispatchEvent(
        new CustomEvent('charEdge:instant-trade', {
          detail: {
            side,
            symbol: symbol || state.symbol,
            price: state.aggregatedPrice,
            tf: state.tf,
            accountId,
            qty: resolvedQty,
            dollarAmount: resolvedDollar,
          },
        }),
      );
    },
    [symbol, resolvedQty, resolvedDollar],
  );

  // #46: Chart keyboard shortcuts
  useHotkeys(
    [
      { key: 'b', handler: () => dispatchInstantTrade('long'), description: 'Quick Buy' },
      { key: 's', handler: () => dispatchInstantTrade('short'), description: 'Quick Sell' },
      {
        key: ' ',
        handler: () => window.dispatchEvent(new CustomEvent('tf:toggleCrosshair')),
        description: 'Toggle crosshair',
      },
      { key: 'alt+s', handler: () => onSnapshot?.(), description: 'Chart snapshot' },
    ],
    { scope: 'critical:chart', enabled: true },
  );
  // Chart Store State
  const tf = useChartCoreStore((s) => s.tf);
  const setTf = useChartCoreStore((s) => s.setTf);
  const chartType = useChartCoreStore((s) => s.chartType);
  const setChartType = useChartCoreStore((s) => s.setChartType);
  const showCustomTf = useChartFeaturesStore((s) => s.showCustomTf);
  const toggleCustomTf = useChartFeaturesStore((s) => s.toggleCustomTf);

  const toolbarRef = useRef(null);

  return (
    <div
      ref={toolbarRef}
      className="tf-chart-toolbar"
      data-container="toolbar"
      role="toolbar"
      aria-label="Chart toolbar"
      style={{
        gap: isMobile ? 2 : 4,
        ...(isMobile
          ? { padding: '0 6px', height: 'auto', overflow: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }
          : {}),
      }}
    >
      {/* P2 2.6: Compact mode indicator */}
      {isMobile && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: C.y,
            opacity: 0.6,
            flexShrink: 0,
            marginRight: 2,
          }}
          title="Compact mode — some controls hidden"
        />
      )}
      {/* ─── Navigation Capsule (Ticker + Timeframes) ──────────── */}
      <div className="tf-nav-capsule">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="tf-nav-capsule__ticker"
          title="Search Symbol (Ctrl+K)"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.45 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {symbol}
          <span style={{ fontSize: 7, opacity: 0.4 }}>▾</span>
        </button>
        <div className="tf-nav-capsule__divider" />
        <TimeframeCapsule tf={tf} setTf={setTf} showCustomTf={showCustomTf} toggleCustomTf={toggleCustomTf} />
      </div>

      {/* ─── Chart Tools Capsule (Type, Indicators, Drawing, AI) ── */}
      {!isMobile && (
        <div className="tf-tools-capsule">
          <ChartTypeSelector chartType={chartType} setChartType={setChartType} />
          <div className="tf-tools-capsule__divider" />
          <ToolbarBtn
            active={showIndicators}
            onClick={() => setShowIndicators(!showIndicators)}
            title="Indicators"
          >
            ƒx
          </ToolbarBtn>
          <div className="tf-tools-capsule__divider" />
          <div style={{ position: 'relative' }} ref={drawBtnRef}>
            <ToolbarBtn
              active={!!storeActiveTool}
              onClick={() => setDrawSelectorOpen(!drawSelectorOpen)}
              title="Drawing Tools"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <line x1="8.5" y1="3.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              </svg>
            </ToolbarBtn>
            <DrawingToolSelector
              open={drawSelectorOpen}
              onClose={() => setDrawSelectorOpen(false)}
              activeTool={storeActiveTool}
              setActiveTool={setActiveTool}
              anchorRef={drawBtnRef}
            />
          </div>
          <div className="tf-tools-capsule__divider" />
          <ToolbarBtn
            active={false}
            onClick={onToggleAnalysis}
            title="AI Analysis"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="rgba(232,100,44,0.2)"
              />
            </svg>
          </ToolbarBtn>
        </div>
      )}

      {/* Mobile: indicators only (no capsule) */}
      {isMobile && (
        <ToolbarBtn
          active={showIndicators}
          onClick={() => setShowIndicators(!showIndicators)}
          title="Indicators"
          style={{ flexShrink: 0 }}
        >
          ƒx
        </ToolbarBtn>
      )}

      {/* Flex spacer — pushes trade capsule to the right */}
      <div style={{ flex: 1, minWidth: 4 }} />

      {/* ─── Apple-Style Trade Capsule (unified right controls) ──── */}
      {!isMobile && (
        <div className="tf-trade-capsule">
          {/* Account status indicator */}
          {(() => {
            const acct = ACCOUNTS.find((a) => a.id === activeAccountId) || ACCOUNTS[0];
            return (
              <button
                className="tf-trade-capsule__account"
                onClick={toggleAccount}
                title={`Trading as ${acct.label} — click to switch`}
                style={{ color: acct.color }}
              >
                <span
                  className="tf-trade-capsule__account-dot"
                  style={{ background: acct.color }}
                />
                {acct.label}
              </button>
            );
          })()}

          {/* BUY */}
          <button
            className="tf-trade-capsule__buy"
            onClick={() => dispatchInstantTrade('long')}
            title="Buy (B)"
          >
            BUY
          </button>

          {/* Position Sizer */}
          <div className="tf-trade-capsule__sizer">
            <div
              className="tf-trade-capsule__sizer-row"
              title={sizeMode === 'usd'
                ? 'Dollar amount — click label to switch to qty'
                : `Quantity (${qtyLabel}) — click label to switch to USD`}
            >
              <button
                className="tf-trade-capsule__stepper"
                onClick={() => {
                  const step = sizeMode === 'usd' ? getUsdStep(sizeValue) : getQtyStep(sizeValue, assetClass);
                  const min = sizeMode === 'usd' ? 1 : (assetClass === 'crypto' ? 0.00000001 : 1);
                  setSizeValue((v) => Math.max(min, +((v || 0) - step).toFixed(getQtyPrecision(assetClass))));
                }}
              >
                −
              </button>
              <div className="tf-trade-capsule__sizer-divider" />
              <button
                className="tf-trade-capsule__mode-toggle"
                onClick={toggleSizeMode}
                style={{ color: sizeMode === 'usd' ? 'var(--tf-bullish)' : 'var(--tf-accent)' }}
                title="Click to toggle USD ↔ QTY"
              >
                {sizeMode === 'usd' ? '$' : qtyLabel.slice(0, 4).toUpperCase()}
              </button>
              <input
                type="text"
                inputMode="decimal"
                className="tf-trade-capsule__sizer-input"
                value={sizeValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '' || raw === '0') { setSizeValue(0); return; }
                  const v = parseFloat(raw);
                  if (!isNaN(v) && v >= 0) setSizeValue(v);
                }}
                onBlur={() => {
                  if (!sizeValue || sizeValue < 0) {
                    setSizeValue(sizeMode === 'usd' ? 100 : 1);
                  }
                }}
              />
              <div className="tf-trade-capsule__sizer-divider" />
              <button
                className="tf-trade-capsule__stepper"
                onClick={() => {
                  const step = sizeMode === 'usd' ? getUsdStep(sizeValue) : getQtyStep(sizeValue, assetClass);
                  setSizeValue((v) => +((v || 0) + step).toFixed(getQtyPrecision(assetClass)));
                }}
              >
                +
              </button>
            </div>
            {/* Converted value hint */}
            {livePrice > 0 && sizeValue > 0 && (
              <div
                className="tf-trade-capsule__hint"
                onClick={toggleSizeMode}
                title="Click to switch input mode"
              >
                {sizeMode === 'usd'
                  ? `≈ ${formatQty(resolvedQty, assetClass)} ${qtyLabel}`
                  : `≈ ${formatDollar(resolvedDollar)}`}
              </div>
            )}
          </div>

          {/* SELL */}
          <button
            className="tf-trade-capsule__sell"
            onClick={() => dispatchInstantTrade('short')}
            title="Sell (S)"
          >
            SELL
          </button>

          <div className="tf-trade-capsule__sep" />

          {/* Workspace Presets */}
          <Suspense fallback={null}>
            <WorkspacePresets />
          </Suspense>

          {/* Command Center */}
          <Suspense fallback={null}>
            <CommandCenterMenu
              isMobile={isMobile}
              showTrades={showTrades}
              setShowTrades={setShowTrades}
              showObjectTree={showObjectTree}
              setShowObjectTree={setShowObjectTree}
              onOpenPanel={onOpenPanel}
              onSnapshot={onSnapshot}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
            />
          </Suspense>
        </div>
      )}

      {/* Mobile: minimal right-side controls */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <Suspense fallback={null}>
            <CommandCenterMenu
              isMobile={isMobile}
              showTrades={showTrades}
              setShowTrades={setShowTrades}
              showObjectTree={showObjectTree}
              setShowObjectTree={setShowObjectTree}
              onOpenPanel={onOpenPanel}
              onSnapshot={onSnapshot}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
            />
          </Suspense>
        </div>
      )}

      {/* Symbol Search Modal */}
      <Suspense fallback={null}>
        <SymbolSearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          onSelect={(sym) => {
            onSearchSelect(sym);
            setSymbolInput(sym);
          }}
          onSearch={fetchSymbolSearch}
          currentSymbol={symbol}
        />
      </Suspense>
    </div>
  );
}
