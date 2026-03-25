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
import { SymbolRegistry } from '../../../data/SymbolRegistry.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import { CHART_COLOR_PRESETS } from '../../../state/user/themeSlice';
import { useUserStore } from '../../../state/useUserStore';
import {
  dollarToQty,
  qtyToDollar,
  getQtyLabel,
  formatQty,
  formatDollar,
  getUsdStep,
  getQtyStep,
  getQtyPrecision,
} from '../../../utils/positionSizeUtils.js';
import ChartTypeSelector from './toolbar/ChartTypeSelector.jsx';
import DrawingToolSelector from './toolbar/DrawingToolSelector.jsx';
import st from './UnifiedChartToolbar.module.css';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useBreakpoints } from '@/hooks/useMediaQuery';
import { useAccountStore, ACCOUNTS } from '@/state/useAccountStore';

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
      className={`tf-chart-toolbar-btn ${disabled ? st.toolbarBtnDisabled : ''}`}
      data-active={active || undefined}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      style={style}
    >
      {children}
    </button>
  );
}

// ─── Chart Color Picker (dropdown) ───────────────────────────────
function ChartColorPicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const chartColorPreset = useUserStore((s) => s.chartColorPreset);
  const setChartColorPreset = useUserStore((s) => s.setChartColorPreset);
  const activePreset = CHART_COLOR_PRESETS.find((p) => p.id === chartColorPreset) || CHART_COLOR_PRESETS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={st.capsuleRelative}>
      <ToolbarBtn onClick={() => setOpen(!open)} title={`Chart Colors: ${activePreset.label}`} active={open}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5" cy="5" r="3" fill={activePreset.bull} opacity="0.9" />
          <circle cx="9" cy="9" r="3" fill={activePreset.bear} opacity="0.9" />
        </svg>
      </ToolbarBtn>
      {open && (
        <div className={st.colorPickerDropdown}>
          <div className={st.colorPickerTitle}>Chart Colors</div>
          {CHART_COLOR_PRESETS.map((preset) => {
            const active = chartColorPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setChartColorPreset(preset.id);
                  setOpen(false);
                }}
                className={st.colorPresetBtn}
                data-active={active ? 'true' : undefined}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = `${C.t3}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                }}
              >
                <div className={st.colorPresetBars}>
                  {[preset.bull, preset.bear, preset.bull, preset.bear].map((clr, i) => (
                    <div
                      key={i}
                      className={st.colorPresetBar}
                      style={{ height: [12, 16, 10, 14][i], background: clr }}
                    />
                  ))}
                </div>
                <span className={st.colorPresetLabel} data-active={active ? 'true' : 'false'}>
                  {preset.label}
                </span>
                {active && <span className={st.colorPresetCheck}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
    <div className={`tf-chart-tf-group ${st.capsuleRelative}`} ref={groupRef}>
      {/* Animated capsule background */}
      {capsule.ready && (
        <div className={`tf-capsule-slider ${st.capsuleSlider}`} style={{ left: capsule.left, width: capsule.width }} />
      )}
      {TFS.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            pillRefs.current[t.id] = el;
          }}
          className={`tf-chart-tf-pill ${st.tfPill}`}
          data-active={tf === t.id || undefined}
          onClick={() => setTf(t.id)}
        >
          {t.label}
        </button>
      ))}
      {/* Custom Timeframe */}
      <div ref={customTfRef} className={st.tfPillRelative}>
        <button
          data-active={showCustomTf || undefined}
          onClick={toggleCustomTf}
          title="Custom Timeframe"
          className={`tf-chart-tf-pill ${st.customTfBtn}`}
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
  // Batch 2: AI Analysis removed — copilot lives in side panel now
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
      className={`tf-chart-toolbar ${isMobile ? st.toolbarMobile : st.toolbarDesktop}`}
      data-container="toolbar"
      role="toolbar"
      aria-label="Chart toolbar"
    >
      {/* P2 2.6: Compact mode indicator */}
      {isMobile && <div className={st.compactDot} title="Compact mode — some controls hidden" />}
      {/* ─── Navigation Capsule (Ticker + Timeframes) ──────────── */}
      <div className="tf-nav-capsule">
        <button
          onClick={() => setSearchModalOpen(true)}
          className="tf-nav-capsule__ticker"
          title="Search Symbol (Ctrl+K)"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className={st.searchIcon}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {symbol}
          <span className={st.tickerChevron}>▾</span>
        </button>
        <div className="tf-nav-capsule__divider" />
        <TimeframeCapsule tf={tf} setTf={setTf} showCustomTf={showCustomTf} toggleCustomTf={toggleCustomTf} />
      </div>

      {/* ─── Chart Tools Capsule (Type, Indicators, Drawing, AI) ── */}
      {!isMobile && (
        <div className="tf-tools-capsule">
          <ChartTypeSelector chartType={chartType} setChartType={setChartType} />
          <div className="tf-tools-capsule__divider" />
          <ToolbarBtn active={showIndicators} onClick={() => setShowIndicators(!showIndicators)} title="Indicators">
            ƒx
          </ToolbarBtn>
          <div className="tf-tools-capsule__divider" />
          <div className={st.capsuleRelative} ref={drawBtnRef}>
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
          <ChartColorPicker />
        </div>
      )}

      {/* Mobile: indicators only (no capsule) */}
      {isMobile && (
        <ToolbarBtn active={showIndicators} onClick={() => setShowIndicators(!showIndicators)} title="Indicators">
          ƒx
        </ToolbarBtn>
      )}

      {/* Flex spacer — pushes trade capsule to the right */}
      <div className={st.spacer} />

      {/* ─── Apple-Style Trade Capsule (unified right controls) ──── */}
      {!isMobile && (
        <div className="tf-trade-capsule">
          {/* Account status indicator */}
          {(() => {
            const acct = ACCOUNTS.find((a) => a.id === activeAccountId) || ACCOUNTS[0];
            return (
              <button
                className={`tf-trade-capsule__account ${st.acctColor}`}
                onClick={toggleAccount}
                title={`Trading as ${acct.label} — click to switch`}
                style={{ '--acct-color': acct.color }}
              >
                <span className={`tf-trade-capsule__account-dot ${st.acctDot}`} />
                {acct.label}
              </button>
            );
          })()}

          {/* BUY */}
          <button className="tf-trade-capsule__buy" onClick={() => dispatchInstantTrade('long')} title="Buy (B)">
            BUY
          </button>

          {/* Position Sizer */}
          <div className="tf-trade-capsule__sizer">
            <div
              className="tf-trade-capsule__sizer-row"
              title={
                sizeMode === 'usd'
                  ? 'Dollar amount — click label to switch to qty'
                  : `Quantity (${qtyLabel}) — click label to switch to USD`
              }
            >
              <button
                className="tf-trade-capsule__stepper"
                onClick={() => {
                  const step = sizeMode === 'usd' ? getUsdStep(sizeValue) : getQtyStep(sizeValue, assetClass);
                  const min = sizeMode === 'usd' ? 1 : assetClass === 'crypto' ? 0.00000001 : 1;
                  setSizeValue((v) => Math.max(min, +((v || 0) - step).toFixed(getQtyPrecision(assetClass))));
                }}
              >
                −
              </button>
              <div className="tf-trade-capsule__sizer-divider" />
              <button
                className={`tf-trade-capsule__mode-toggle ${st.modeToggleColor}`}
                onClick={toggleSizeMode}
                style={{ '--mode-color': sizeMode === 'usd' ? 'var(--tf-bullish)' : 'var(--tf-accent)' }}
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
                  if (raw === '' || raw === '0') {
                    setSizeValue(0);
                    return;
                  }
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
              <div className="tf-trade-capsule__hint" onClick={toggleSizeMode} title="Click to switch input mode">
                {sizeMode === 'usd'
                  ? `≈ ${formatQty(resolvedQty, assetClass)} ${qtyLabel}`
                  : `≈ ${formatDollar(resolvedDollar)}`}
              </div>
            )}
          </div>

          {/* SELL */}
          <button className="tf-trade-capsule__sell" onClick={() => dispatchInstantTrade('short')} title="Sell (S)">
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
        <div className={st.mobileRow}>
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
