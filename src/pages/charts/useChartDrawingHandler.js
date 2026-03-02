// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartDrawingHandler
// Extracts drawing tool click handling, drawing event listeners,
// AI copilot command parsing, and chart export logic from ChartsPage.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { useChartStore } from '../../state/useChartStore.js';
import { useChartTradeHandler } from '../../app/components/chart/chart_ui/useChartTradeHandler.js';
import { TOOL_CONFIG, magnetSnap } from '../../charting_library/tools/drawingTools.js';
import { exportChartPNG, copyChartToClipboard, generateShareURL } from '../../utils/chartExport.js';
import { parseChartCommand } from '../../charting_library/ai/AICopilotEngine.js';
import useScriptRunner from '../../charting_library/scripting/useScriptRunner.js';

/**
 * Hook that manages drawing tool interactions, AI copilot commands,
 * chart exports, and script execution.
 *
 * @param {React.RefObject} chartRef - Ref to the ChartCanvas component
 * @returns {Object} Drawing handlers, copilot handler, export handlers, script outputs
 */
export default function useChartDrawingHandler(chartRef) {
  const symbol = useChartStore((s) => s.symbol);
  const tf = useChartStore((s) => s.tf);
  const chartType = useChartStore((s) => s.chartType);
  const indicators = useChartStore((s) => s.indicators);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const setTf = useChartStore((s) => s.setTf);
  const data = useChartStore((s) => s.data);
  const activeTool = useChartStore((s) => s.activeTool);
  const pendingDrawing = useChartStore((s) => s.pendingDrawing);
  const setPendingDrawing = useChartStore((s) => s.setPendingDrawing);
  const addDrawing = useChartStore((s) => s.addDrawing);
  const magnetMode = useChartStore((s) => s.magnetMode);
  const tradeMode = useChartStore((s) => s.tradeMode);

  const { handleChartClick: handleTradeClick, handleContextMenu, contextMenuHandlers } = useChartTradeHandler();

  const [copyFeedback, setCopyFeedback] = useState(false);

  // Script engine — auto-runs enabled scripts against current data
  const { scriptOutputs, setEditorOutputs, errors: _scriptErrors } = useScriptRunner(data);

  // --- Drawing Tool Event Listeners (Legacy Canvas Bridge) ---
  useEffect(() => {
    const handleClear = () => useChartStore.getState().setDrawings([]);
    const handleDelete = () => {
      const state = useChartStore.getState();
      if (state.selectedDrawingId) {
        state.setDrawings(state.drawings.filter((d) => d.id !== state.selectedDrawingId));
        state.setSelectedDrawing(null);
      }
    };
    const handleToggleVis = (e) => {
      const id = e.detail;
      const state = useChartStore.getState();
      state.setDrawings(
        state.drawings.map((d) => (d.id === id ? { ...d, visible: d.visible === false ? true : false } : d)),
      );
    };
    const handleToggleLock = (e) => {
      const id = e.detail;
      const state = useChartStore.getState();
      state.setDrawings(state.drawings.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d)));
    };
    const handleDeleteSpecific = (e) => {
      const id = e.detail;
      const state = useChartStore.getState();
      state.setDrawings(state.drawings.filter((d) => d.id !== id));
      if (state.selectedDrawingId === id) state.setSelectedDrawing(null);
    };

    window.addEventListener('charEdge:clear-drawings', handleClear);
    window.addEventListener('charEdge:delete-drawing', handleDelete);
    window.addEventListener('charEdge:toggle-visibility', handleToggleVis);
    window.addEventListener('charEdge:toggle-lock', handleToggleLock);
    window.addEventListener('charEdge:delete-specific', handleDeleteSpecific);

    return () => {
      window.removeEventListener('charEdge:clear-drawings', handleClear);
      window.removeEventListener('charEdge:delete-drawing', handleDelete);
      window.removeEventListener('charEdge:toggle-visibility', handleToggleVis);
      window.removeEventListener('charEdge:toggle-lock', handleToggleLock);
      window.removeEventListener('charEdge:delete-specific', handleDeleteSpecific);
    };
  }, []);

  // Drawing tool click handler — uses TOOL_CONFIG for behavior
  const handleDrawingClick = useCallback(
    ({ price, barIdx }) => {
      // Trade mode takes priority over drawing tools
      if (tradeMode) {
        handleTradeClick(price, barIdx);
        return;
      }

      if (!activeTool) return;

      const config = TOOL_CONFIG[activeTool];
      if (!config) return;
      const color = config.color;

      // Magnet mode — snap to nearest OHLC
      let snapPrice = price,
        snapBarIdx = barIdx;
      if (magnetMode && data?.length) {
        const snapped = magnetSnap(price, barIdx, data);
        snapPrice = snapped.price;
        snapBarIdx = snapped.barIdx;
      }

      // Single-click tools (clicks: 1)
      if (config.clicks === 1) {
        const drawing = { type: activeTool, points: [{ price: snapPrice, barIdx: snapBarIdx }], color };
        if (activeTool === 'text' || activeTool === 'callout') {
          const text = prompt('Enter text:', '');
          if (!text) return;
          drawing.text = text;
        }
        addDrawing(drawing);
        return;
      }

      // Multi-click tools (clicks: 2 or 3)
      if (!pendingDrawing) {
        setPendingDrawing({ type: activeTool, points: [{ price: snapPrice, barIdx: snapBarIdx }], color });
      } else if (config.clicks === 3 && pendingDrawing.points.length === 1) {
        setPendingDrawing({
          ...pendingDrawing,
          points: [...pendingDrawing.points, { price: snapPrice, barIdx: snapBarIdx }],
        });
      } else {
        const drawing = {
          type: pendingDrawing.type,
          points: [...pendingDrawing.points, { price: snapPrice, barIdx: snapBarIdx }],
          color: pendingDrawing.color,
        };
        if (pendingDrawing.type === 'callout') {
          const text = prompt('Enter callout text:', '');
          if (text) drawing.text = text;
        }
        addDrawing(drawing);
      }
    },
    [activeTool, pendingDrawing, setPendingDrawing, addDrawing, magnetMode, data, tradeMode, handleTradeClick],
  );

  // AI Copilot command handler
  const handleAICopilotCommand = useCallback(
    (inputText) => {
      const command = parseChartCommand(inputText);

      if (!command) {
        import('../../app/components/ui/Toast.jsx').then(({ default: toast }) => toast.error("AI couldn't understand that command")).catch(() => {}); // intentional: Toast import is best-effort UI
        return { success: false, message: "I didn't quite catch that." };
      }

      const store = useChartStore.getState();
      let resultMessage = '';

      switch (command.action) {
        case 'add_indicator':
          store.addIndicator({ type: command.payload });
          resultMessage = `Added ${command.payload} to chart.`;
          break;
        case 'clear_indicators':
          store.setIndicators([]);
          resultMessage = 'Cleared all indicators.';
          break;
        case 'clear_drawings':
          store.setDrawings([]);
          resultMessage = 'Cleared all drawings.';
          break;
        case 'clear_all':
          store.setIndicators([]);
          store.setDrawings([]);
          resultMessage = 'Cleared chart fully.';
          break;
        case 'change_tf':
          setTf(command.payload);
          resultMessage = `Switched timeframe to ${command.payload}.`;
          break;
        case 'change_symbol':
          setSymbol(command.payload);
          resultMessage = `Switched symbol to ${command.payload}.`;
          break;
        case 'activate_tool':
          store.setActiveTool(command.payload);
          resultMessage = `Activated ${command.payload} drawing tool.`;
          break;
        default:
          resultMessage = 'Unhandled AI action.';
          return { success: false, message: resultMessage };
      }

      import('../../app/components/ui/Toast.jsx')
        .then(({ default: toast }) => toast.success(resultMessage))
        .catch(() => {}); // intentional: Toast import is best-effort UI

      return { success: true, message: resultMessage };
    },
    [setTf, setSymbol]
  );

  // Export handlers
  const handleExportPNG = useCallback(() => {
    const canvas = chartRef.current?.getCanvas();
    if (canvas) exportChartPNG(canvas, null, { symbol, tf });
  }, [symbol, tf, chartRef]);

  const handleCopyChart = useCallback(async () => {
    const canvas = chartRef.current?.getCanvas();
    if (!canvas) return;
    const ok = await copyChartToClipboard(canvas);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  }, [chartRef]);

  const handleShareURL = useCallback(() => {
    const url = generateShareURL({ symbol, tf, chartType, indicators });
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 1500);
      })
      .catch(() => {
        window.prompt('Share URL:', url);
      });
  }, [symbol, tf, chartType, indicators]);

  return {
    handleDrawingClick,
    handleAICopilotCommand,
    handleExportPNG,
    handleCopyChart,
    handleShareURL,
    handleContextMenu,
    contextMenuHandlers,
    copyFeedback,
    scriptOutputs,
    setEditorOutputs,
  };
}
