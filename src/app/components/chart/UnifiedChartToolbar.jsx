// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Chart Toolbar (Decomposed)
// Thin composition layer that imports sub-components:
//   - ChartTypeSelector (chart type picker + preview)
//   - ToolbarMoreMenu (≡ menu with all categorized items)
//   - TimeframeCapsule (animated TF pills)
//   - WorkspacePresets (lazy-loaded)
// Drawing tools are handled by DrawingSidebar toggle.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, Suspense } from 'react';
import { C, F, M, TFS } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import DataSourceBadge from './ui/DataSourceBadge.jsx';

// Extracted sub-components
import ChartTypeSelector from './toolbar/ChartTypeSelector.jsx';

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
          ref={(el) => { pillRefs.current[t.id] = el; }}
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
  symbol, setSymbolInput, onSearchSelect,
  isWatched, toggleWatchlist,
  showIndicators, setShowIndicators,
  showObjectTree, setShowObjectTree,
  showTrades, setShowTrades, matchingTradesCount,
  fetchSymbolSearch,
  onOpenPanel, // new prop to handle opening secondary panels in SlidePanel
  onOpenCopilot, // Phase 2 AI
  onSnapshot, // Snapshot callback
  // Data source props for badge
  isLive, wsSupported, wsStatus, dataSource, dataLoading,
  // Layout
  layoutMode, setLayoutMode,
  // Batch 2: AI Analysis
  onToggleAnalysis,
  // Sprint 12: Drawing sidebar
  drawSidebarOpen, onToggleDrawSidebar,
}) {
  const { isMobile } = useBreakpoints();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Watchlist items for inline chips
  const watchlistItems = useWatchlistStore((s) => s.items);

  // Chart Store State
  const tf = useChartStore((s) => s.tf);
  const setTf = useChartStore((s) => s.setTf);
  const chartType = useChartStore((s) => s.chartType);
  const setChartType = useChartStore((s) => s.setChartType);
  const showCustomTf = useChartStore((s) => s.showCustomTf);
  const toggleCustomTf = useChartStore((s) => s.toggleCustomTf);

  // ─── Toolbar Compact Mode (Apple: no ghosting) ──────────────
  // After 5s of inactivity, shrink toolbar to 32px (icons only).
  // Symbol stays visible. Hover/focus restores full 44px.
  const toolbarRef = useRef(null);
  const ghostTimerRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);

  const resetGhostTimer = useCallback(() => {
    setIsCompact(false);
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    ghostTimerRef.current = setTimeout(() => setIsCompact(true), 5000);
  }, []);

  useEffect(() => {
    resetGhostTimer();
    return () => { if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current); };
  }, [resetGhostTimer]);

  return (
    <div
      ref={toolbarRef}
      className={`tf-chart-toolbar${isCompact ? ' tf-toolbar-compact' : ''}`}
      data-container="toolbar"
      role="toolbar"
      aria-label="Chart toolbar"
      onMouseMove={resetGhostTimer}
      onMouseDown={resetGhostTimer}
      onKeyDown={resetGhostTimer}
      style={{
        gap: isMobile ? 2 : 4,
        ...(isMobile ? { padding: '0 6px', height: 'auto', overflow: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' } : {}),
      }}
    >
      {/* 1. SYMBOL + SEARCH MODAL TRIGGER + DATA SOURCE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => setSearchModalOpen(true)}
          className="tf-chart-toolbar-btn"
          title="Search Symbol (Ctrl+K)"
          style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.5px', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {symbol}
          <span style={{ fontSize: 8, color: C.t3 }}>▼</span>
        </button>
        <ToolbarBtn active={isWatched} onClick={toggleWatchlist} title="Watchlist">★</ToolbarBtn>
        <DataSourceBadge
          isLive={isLive} wsSupported={wsSupported} wsStatus={wsStatus}
          dataSource={dataSource} dataLoading={dataLoading}
        />
      </div>

      {/* WATCHLIST CHIPS — inline symbol toggles */}
      {!isMobile && watchlistItems.length > 0 && (
        <>
          <Divider />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
            flexShrink: 1,
            minWidth: 0,
          }}>
            {watchlistItems.slice(0, 5).map((item) => {
              const sym = item.symbol;
              const isActive = sym === symbol;
              return (
                <button
                  key={sym}
                  className="tf-chart-toolbar-btn"
                  data-active={isActive || undefined}
                  onClick={() => { onSearchSelect(sym); setSymbolInput(sym); }}
                  title={sym}
                  style={{
                    fontSize: 10.5,
                    fontWeight: isActive ? 700 : 500,
                    padding: '2px 7px',
                    flexShrink: 0,
                    borderRadius: 10,
                  }}
                >
                  {sym}
                </button>
              );
            })}
            {watchlistItems.length > 5 && (
              <span style={{
                fontSize: 9, color: C.t3, fontWeight: 600, padding: '2px 4px',
                fontFamily: F,
              }}>
                +{watchlistItems.length - 5}
              </span>
            )}
          </div>
        </>
      )}

      <Divider />

      {/* 2. TIMEFRAMES — Animated Capsule Slider */}
      <TimeframeCapsule tf={tf} setTf={setTf} showCustomTf={showCustomTf} toggleCustomTf={toggleCustomTf} />

      <Divider />

      {/* 3. CHART TYPES — Visual preview grid */}
      {!isMobile && (
        <ChartTypeSelector chartType={chartType} setChartType={setChartType} />
      )}

      {!isMobile && <Divider />}

      {/* 4. INDICATORS */}
      <ToolbarBtn active={showIndicators} onClick={() => setShowIndicators(!showIndicators)} title="Indicators" style={{ flexShrink: 0 }}>
        ƒx
      </ToolbarBtn>

      {/* Sprint 12: Draw Sidebar Toggle */}
      {!isMobile && (
        <>
          <Divider />
          <ToolbarBtn
            active={drawSidebarOpen}
            onClick={onToggleDrawSidebar}
            title="Drawing Tools"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="8.5" y1="3.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            </svg>
          </ToolbarBtn>
        </>
      )}

      {/* AI Analysis Panel Toggle — subtle accent glow */}
      {!isMobile && (
        <>
          <Divider />
          <ToolbarBtn
            active={false}
            onClick={onToggleAnalysis}
            title="AI Analysis"
            style={{
              background: 'rgba(232,100,44,0.08)',
              boxShadow: '0 0 6px rgba(232,100,44,0.12)',
              borderRadius: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(232,100,44,0.2)" />
            </svg>
          </ToolbarBtn>
        </>
      )}

      {/* Flex spacer */}
      <div style={{ flex: 1, minWidth: 4 }} />

      {/* RIGHT-SIDE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {/* Sprint 9: Workspace Presets */}
        {!isMobile && (
          <Suspense fallback={null}>
            <WorkspacePresets />
          </Suspense>
        )}
        {/* SETTINGS / MORE MENU — Contains all moved toolbar items */}
        <Suspense fallback={null}>
          <CommandCenterMenu
            isMobile={isMobile}
            showTrades={showTrades} setShowTrades={setShowTrades}
            showObjectTree={showObjectTree} setShowObjectTree={setShowObjectTree}
            onOpenPanel={onOpenPanel}
            onSnapshot={onSnapshot}
            layoutMode={layoutMode} setLayoutMode={setLayoutMode}
          />
        </Suspense>
      </div>

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
