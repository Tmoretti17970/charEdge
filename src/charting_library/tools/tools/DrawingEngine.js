// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine (Core Facade)
// State machine for drawing tool interactions.
//
// States:
//   IDLE     → No tool active, click selects/deselects drawings
//   CREATING → Tool active, clicking places anchor points
//   SELECTED → A drawing is selected, can drag anchors or delete
//   DRAGGING → An anchor point is being dragged
//   MOVING   → Entire drawing is being moved
//
// The engine does NOT render — it manages data and emits events.
// Rendering is handled by DrawingRenderer (separate file).
//
// Heavy logic is delegated to sub-modules:
//   DrawingHitTest.js  — geometry-based hit testing
//   DrawingSnap.js     — magnet snap, angle snap, smart guides
//   DrawingCRUD.js     — add/remove/duplicate/multi-select/clipboard/groups
// ═══════════════════════════════════════════════════════════════════

import { createDrawing, TOOL_POINT_COUNT } from './DrawingModel.js';

// ── Sub-modules ──────────────────────────────────────────────────
import { hitTestDrawingBody, distToSegment } from '../engines/DrawingHitTest.js';
import {
  doMagnetSnap as doMagnetSnapImpl,
  applyAngleSnap as applyAngleSnapImpl,
  getSmartGuides as getSmartGuidesImpl,
  getRoundPriceLevels,
  formatRound,
} from '../engines/DrawingSnap.js';
import {
  generateId,
  addDrawing as addDrawingImpl,
  removeDrawing as removeDrawingImpl,
  clearAll as clearAllImpl,
  toggleVisibility as toggleVisibilityImpl,
  toggleLock as toggleLockImpl,
  updateStyle as updateStyleImpl,
  loadDrawings as loadDrawingsImpl,
  duplicateDrawing as duplicateDrawingImpl,
  bringToFront as bringToFrontImpl,
  sendToBack as sendToBackImpl,
  toggleMultiSelect as toggleMultiSelectImpl,
  selectAll as selectAllImpl,
  clearMultiSelect as clearMultiSelectImpl,
  deleteSelected as deleteSelectedImpl,
  batchUpdateStyle as batchUpdateStyleImpl,
  boxSelect as boxSelectImpl,
  copySelected as copySelectedImpl,
  pasteFromClipboard as pasteFromClipboardImpl,
  groupSelected as groupSelectedImpl,
  ungroupDrawings as ungroupDrawingsImpl,
  selectGroup as selectGroupImpl,
  bulkMove as bulkMoveImpl,
  setDrawingLabel as setDrawingLabelImpl,
  toggleSyncAcrossTimeframes as toggleSyncImpl,
} from '../engines/DrawingCRUD.js';

/** Interaction states */
const STATE = {
  IDLE: 'idle',
  CREATING: 'creating',
  SELECTED: 'selected',
  DRAGGING: 'dragging',
  MOVING: 'moving',
};

const ANCHOR_RADIUS = 5;

/**
 * Create a DrawingEngine instance.
 *
 * @param {Object} [options]
 * @param {(drawings: Drawing[]) => void} [options.onChange]
 * @param {(state: string) => void} [options.onStateChange]
 * @returns {Object} DrawingEngine
 */
export function createDrawingEngine(options = {}) {
  const { onChange, onStateChange, magnetSnap } = options;

  // ── State ──
  let drawings = [];
  let interactionState = STATE.IDLE;
  let activeTool = null;
  let activeDrawing = null;
  let selectedDrawingId = null;
  let selectedDrawingIds = new Set();
  let hoveredDrawingId = null;
  let hoveredAnchorIdx = -1;
  let dragAnchorIdx = -1;
  let _dragStartPrice = 0;
  let _dragStartTime = 0;
  let dragPointOffsets = [];
  let clipboard = null;

  // ── Sticky mode ──
  let stickyMode = false;
  let stickyToolType = null;
  let stickyStyleOverrides = {};
  let toolStyleMemory = {};

  // Coordinate converters
  let pixelToPrice = null;
  let pixelToTime = null;
  let priceToPixel = null;
  let timeToPixel = null;

  // ── Advanced Snap Data Sources ──
  let _indicatorData = [];
  let _hoverBarIdx = -1;
  let _gridTicks = [];
  let _sceneGraph = null;
  let snapStrength = 15;
  let angleSnap = false;
  let smartGuides = true;
  let lastSnapInfo = null;

  // ── Version counter (for FrameState change detection) ──
  let _version = 0;

  // ── Emit helpers ──
  function emit() { _version++; if (onChange) onChange([...drawings]); }
  function emitState() { _version++; if (onStateChange) onStateChange(interactionState); }
  function setState(newState) { interactionState = newState; emitState(); }

  // ── Coordinate Conversion ──
  function setCoordinateConverters(converters) {
    pixelToPrice = converters.pixelToPrice;
    pixelToTime = converters.pixelToTime;
    priceToPixel = converters.priceToPixel;
    timeToPixel = converters.timeToPixel;
  }

  function anchorToPixel(point) {
    if (!priceToPixel || !timeToPixel) return null;
    return { x: timeToPixel(point.time), y: priceToPixel(point.price) };
  }

  function pixelToAnchor(x, y) {
    return {
      price: pixelToPrice ? pixelToPrice(y) : 0,
      time: pixelToTime ? pixelToTime(x) : Date.now(),
    };
  }

  // ── CRUD context (shared state bridge for sub-module calls) ──
  function getCrudCtx() {
    return {
      get drawings() { return drawings; },
      set drawings(v) { drawings = v; },
      get selectedDrawingId() { return selectedDrawingId; },
      set selectedDrawingId(v) { selectedDrawingId = v; },
      get selectedDrawingIds() { return selectedDrawingIds; },
      get activeDrawing() { return activeDrawing; },
      set activeDrawing(v) { activeDrawing = v; },
      get activeTool() { return activeTool; },
      set activeTool(v) { activeTool = v; },
      anchorToPixel,
      pixelToAnchor,
      emit,
      setState,
    };
  }

  // ── Snap wrappers ──
  function doMagnetSnap(x, y, price, time) {
    const result = doMagnetSnapImpl({
      x, y, price, time, snapStrength, magnetSnap,
      drawings, activeDrawing, anchorToPixel, priceToPixel,
      indicatorData: _indicatorData, hoverBarIdx: _hoverBarIdx, gridTicks: _gridTicks,
    });
    lastSnapInfo = result.snapInfo;
    return { price: result.price, time: result.time };
  }

  // ── Hit Testing ──
  function hitTest(x, y) {
    let candidates = null;
    if (_sceneGraph) {
      const nodes = _sceneGraph.queryPoint(x, y);
      if (nodes.length > 0) {
        const candidateIds = new Set(nodes.filter(n => n.type === 'drawing').map(n => n.data?.id));
        if (candidateIds.size > 0) {
          candidates = [];
          for (let i = drawings.length - 1; i >= 0; i--) {
            if (candidateIds.has(drawings[i].id)) candidates.push(drawings[i]);
          }
        }
      }
    }

    const testList = candidates || drawings;
    const reverseOrder = !candidates;

    if (reverseOrder) {
      for (let i = testList.length - 1; i >= 0; i--) {
        const result = _hitTestSingle(testList[i], x, y);
        if (result) return result;
      }
    } else {
      for (const d of testList) {
        const result = _hitTestSingle(d, x, y);
        if (result) return result;
      }
    }
    return null;
  }

  function _hitTestSingle(d, x, y) {
    if (!d.visible || d.state === 'creating') return null;
    for (let j = 0; j < d.points.length; j++) {
      const px = anchorToPixel(d.points[j]);
      if (!px) continue;
      const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
      if (dist <= ANCHOR_RADIUS + 2) return { drawing: d, anchorIdx: j };
    }
    const points = d.points.map(p => anchorToPixel(p)).filter(Boolean);
    if (hitTestDrawingBody(d, x, y, points)) return { drawing: d, anchorIdx: -1 };
    return null;
  }

  // ── Mouse Event Handlers ──
  let clickDragStartX = 0;
  let clickDragStartY = 0;

  function onMouseDown(x, y) {
    if (interactionState === STATE.CREATING) {
      clickDragStartX = x;
      clickDragStartY = y;
      const p = pixelToAnchor(x, y);
      const snapP = doMagnetSnap(x, y, p.price, p.time);
      if (activeDrawing.points.length > activeDrawing._confirmedPoints) {
        activeDrawing.points[activeDrawing._confirmedPoints] = snapP;
      } else {
        activeDrawing.points.push(snapP);
      }
      activeDrawing._confirmedPoints++;
      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      if (activeDrawing._confirmedPoints >= neededPoints) {
        if (activeDrawing.type && activeDrawing.style) toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
        activeDrawing.state = 'idle';
        if (stickyMode && stickyToolType) {
          activeDrawing = null;
          activeTool = stickyToolType;
          activeDrawing = createDrawing(stickyToolType, null, stickyStyleOverrides);
          activeDrawing._confirmedPoints = 0;
          drawings.push(activeDrawing);
          setState(STATE.CREATING);
        } else {
          activeDrawing = null;
          activeTool = null;
          setState(STATE.IDLE);
        }
      }
      emit();
      return true;
    }

    const hit = hitTest(x, y);
    if (hit) {
      selectedDrawingId = hit.drawing.id;
      drawings.forEach(d => (d.state = d.id === selectedDrawingId ? 'selected' : 'idle'));
      if (hit.anchorIdx >= 0 && !hit.drawing.locked) {
        dragAnchorIdx = hit.anchorIdx;
        setState(STATE.DRAGGING);
      } else if (!hit.drawing.locked) {
        const anchor = pixelToAnchor(x, y);
        _dragStartPrice = anchor.price;
        _dragStartTime = anchor.time;
        dragPointOffsets = hit.drawing.points.map(p => ({ dPrice: p.price - anchor.price, dTime: p.time - anchor.time }));
        setState(STATE.MOVING);
      } else {
        setState(STATE.SELECTED);
      }
      emit();
      return true;
    }

    if (selectedDrawingId) {
      selectedDrawingId = null;
      drawings.forEach(d => (d.state = 'idle'));
      setState(STATE.IDLE);
      emit();
    }
    return false;
  }

  function onMouseMove(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing) {
      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      const rawAnchor = pixelToAnchor(x, y);
      const anchor = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);
      if (activeDrawing.points.length > 0 && activeDrawing.points.length < neededPoints) {
        if (activeDrawing.points.length === activeDrawing._confirmedPoints) {
          activeDrawing.points.push(anchor);
        } else {
          activeDrawing.points[activeDrawing.points.length - 1] = anchor;
        }
        emit();
      }
      return true;
    }

    if (interactionState === STATE.DRAGGING && selectedDrawingId) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing && dragAnchorIdx >= 0) {
        const rawAnchor = pixelToAnchor(x, y);
        drawing.points[dragAnchorIdx] = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);
        emit();
      }
      return true;
    }

    if (interactionState === STATE.MOVING && selectedDrawingId) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing) {
        const anchor = pixelToAnchor(x, y);
        for (let i = 0; i < drawing.points.length; i++) {
          drawing.points[i] = { price: anchor.price + dragPointOffsets[i].dPrice, time: anchor.time + dragPointOffsets[i].dTime };
        }
        emit();
      }
      return true;
    }

    if (interactionState === STATE.IDLE || interactionState === STATE.SELECTED) {
      const hit = hitTest(x, y);
      const newHoveredId = hit ? hit.drawing.id : null;
      let newAnchorIdx = -1;
      if (hit) {
        for (let ai = 0; ai < hit.drawing.points.length; ai++) {
          const ap = anchorToPixel(hit.drawing.points[ai]);
          if (!ap) continue;
          if (Math.sqrt((x - ap.x) ** 2 + (y - ap.y) ** 2) < 8) { newAnchorIdx = ai; break; }
        }
      }
      if (newHoveredId !== hoveredDrawingId || newAnchorIdx !== hoveredAnchorIdx) {
        hoveredDrawingId = newHoveredId;
        hoveredAnchorIdx = newAnchorIdx;
        emit();
      }
    }
    return false;
  }

  function onMouseUp(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing && activeDrawing._confirmedPoints > 0) {
      if (typeof x === 'number' && typeof y === 'number') {
        const dx = x - clickDragStartX, dy = y - clickDragStartY;
        if (dx * dx + dy * dy > 100) {
          const p = pixelToAnchor(x, y);
          const snapP = doMagnetSnap(x, y, p.price, p.time);
          if (activeDrawing.points.length > activeDrawing._confirmedPoints) {
            activeDrawing.points[activeDrawing._confirmedPoints] = snapP;
          } else {
            activeDrawing.points.push(snapP);
          }
          activeDrawing._confirmedPoints++;
          const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
          if (activeDrawing._confirmedPoints >= neededPoints) {
            if (activeDrawing.type && activeDrawing.style) toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
            activeDrawing.state = 'idle';
            if (stickyMode && stickyToolType) {
              activeDrawing = null;
              activeTool = stickyToolType;
              activeDrawing = createDrawing(stickyToolType, null, stickyStyleOverrides);
              activeDrawing._confirmedPoints = 0;
              drawings.push(activeDrawing);
              setState(STATE.CREATING);
            } else {
              activeDrawing = null;
              activeTool = null;
              setState(STATE.IDLE);
            }
          }
          emit();
          return true;
        }
      }
    }
    if (interactionState === STATE.DRAGGING || interactionState === STATE.MOVING) {
      setState(selectedDrawingId ? STATE.SELECTED : STATE.IDLE);
      dragAnchorIdx = -1;
      emit();
      return true;
    }
    return false;
  }

  function onDoubleClick(x, y) {
    const hit = hitTest(x, y);
    if (!hit) return false;
    const drawing = hit.drawing;
    if (drawing.type === 'text' || drawing.type === 'callout') {
      const px = anchorToPixel(drawing.points[0]);
      if (px) {
        window.dispatchEvent(new CustomEvent('charEdge:edit-drawing-text', {
          detail: { id: drawing.id, text: drawing.meta?.text || (drawing.type === 'callout' ? 'Price Note' : 'Text'), x: px.x, y: px.y, type: drawing.type },
        }));
      }
    }
    const refPoint = anchorToPixel(drawing.points[0]);
    if (refPoint) {
      selectedDrawingId = drawing.id;
      drawings.forEach(d => (d.state = d.id === selectedDrawingId ? 'selected' : 'idle'));
      setState(STATE.SELECTED);
      emit();
      window.dispatchEvent(new CustomEvent('charEdge:edit-drawing', {
        detail: { id: drawing.id, type: drawing.type, points: drawing.points.map(p => ({ ...p })), style: { ...drawing.style }, meta: drawing.meta ? { ...drawing.meta } : {}, locked: drawing.locked, visible: drawing.visible, pixelX: x, pixelY: y },
      }));
    }
    return true;
  }

  function onKeyDown(key) {
    if (key === 'Escape') {
      if (stickyMode) { stickyMode = false; stickyToolType = null; stickyStyleOverrides = {}; }
      if (interactionState === STATE.CREATING && activeDrawing) {
        drawings = drawings.filter(d => d.id !== activeDrawing.id);
        activeDrawing = null; activeTool = null;
        setState(STATE.IDLE); emit(); return true;
      }
      if (selectedDrawingId) {
        selectedDrawingId = null;
        drawings.forEach(d => (d.state = 'idle'));
        setState(STATE.IDLE); emit(); return true;
      }
    }
    if (key === 'Backspace' && interactionState === STATE.CREATING && activeDrawing) {
      if (activeDrawing._confirmedPoints > 0) {
        activeDrawing._confirmedPoints--;
        if (activeDrawing.points.length > activeDrawing._confirmedPoints) activeDrawing.points.length = activeDrawing._confirmedPoints;
        if (activeDrawing._confirmedPoints === 0) {
          const idx = drawings.indexOf(activeDrawing);
          if (idx >= 0) drawings.splice(idx, 1);
          activeDrawing = null; activeTool = null;
          setState(STATE.IDLE);
        }
        emit(); return true;
      }
    }
    if ((key === 'Delete' || key === 'Backspace') && selectedDrawingId) {
      drawings = drawings.filter(d => d.id !== selectedDrawingId);
      selectedDrawingId = null;
      setState(STATE.IDLE); emit(); return true;
    }
    if (key === 'c' && interactionState === STATE.SELECTED && selectedDrawingId) {
      const d = drawings.find(d => d.id === selectedDrawingId);
      if (d) { clipboard = JSON.parse(JSON.stringify(d)); return true; }
    }
    if (key === 'v' && clipboard) {
      const pasted = JSON.parse(JSON.stringify(clipboard));
      pasted.id = generateId(); pasted.state = 'idle';
      pasted.points = pasted.points.map(p => ({ price: p.price * 1.002, time: p.time + 60000 }));
      drawings.push(pasted);
      selectedDrawingId = pasted.id; pasted.state = 'selected';
      setState(STATE.SELECTED); emit(); return true;
    }
    if (key === 'd' && interactionState === STATE.SELECTED && selectedDrawingId) {
      const d = drawings.find(d => d.id === selectedDrawingId);
      if (d) {
        const dup = JSON.parse(JSON.stringify(d));
        dup.id = generateId(); dup.state = 'selected';
        dup.points = dup.points.map(p => ({ price: p.price * 1.003, time: p.time + 120000 }));
        drawings.push(dup); d.state = 'idle';
        selectedDrawingId = dup.id; emit(); return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  return {
    setCoordinateConverters,

    // ── Tool activation ──
    activateTool(toolType, styleOverrides = {}) {
      if (activeDrawing) drawings = drawings.filter(d => d.id !== activeDrawing.id);
      if (stickyMode) { stickyToolType = toolType; stickyStyleOverrides = { ...styleOverrides }; }
      const mergedStyle = Object.keys(styleOverrides).length > 0 ? styleOverrides : (toolStyleMemory[toolType] || {});
      activeTool = toolType;
      activeDrawing = createDrawing(toolType, null, mergedStyle);
      activeDrawing._confirmedPoints = 0;
      drawings.push(activeDrawing);
      selectedDrawingId = null;
      drawings.forEach(d => { if (d !== activeDrawing) d.state = 'idle'; });
      setState(STATE.CREATING); emit();
    },

    cancelTool() {
      stickyMode = false; stickyToolType = null; stickyStyleOverrides = {};
      if (activeDrawing) { drawings = drawings.filter(d => d.id !== activeDrawing.id); activeDrawing = null; activeTool = null; }
      setState(STATE.IDLE); emit();
    },

    get activeTool() { return activeTool; },

    // ── Sticky mode ──
    setStickyMode(enabled) {
      stickyMode = enabled;
      if (!enabled) { stickyToolType = null; stickyStyleOverrides = {}; }
      else if (activeTool) { stickyToolType = activeTool; stickyStyleOverrides = activeDrawing?.style ? { ...activeDrawing.style } : {}; }
    },
    get isStickyMode() { return stickyMode; },
    getToolStyleMemory(toolType) { return toolStyleMemory[toolType] || null; },
    setToolStyleMemory(toolType, style) { toolStyleMemory[toolType] = { ...style }; },

    // ── Enhanced snap API ──
    setSnapStrength(val) { snapStrength = Math.max(3, Math.min(50, val)); },
    setAngleSnap(val) { angleSnap = val; },
    setSmartGuides(val) { smartGuides = val; },
    getSmartGuides(x, y) { return getSmartGuidesImpl(smartGuides, x, y, drawings, activeDrawing, anchorToPixel); },
    applyAngleSnap(startPx, endX, endY) { return applyAngleSnapImpl(angleSnap, startPx, endX, endY); },
    get lastSnapInfo() { return lastSnapInfo; },

    // ── Advanced snap data sources ──
    setIndicatorData(indicators) { _indicatorData = indicators || []; },
    setHoverBarIdx(idx) { _hoverBarIdx = idx; },
    setGridTicks(ticks) { _gridTicks = ticks || []; },

    // ── Event handlers ──
    onMouseDown, onMouseMove, onMouseUp, onDoubleClick, onKeyDown,

    // ── Drawing management (delegated to DrawingCRUD) ──
    get drawings() { return drawings; },
    get selectedDrawing() { return selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null; },
    get hoveredDrawingId() { return hoveredDrawingId; },
    get hoveredAnchorIdx() { return hoveredAnchorIdx; },
    setSceneGraph(sg) { _sceneGraph = sg; },
    get cursorHint() {
      if (interactionState === STATE.CREATING) return 'crosshair';
      if (interactionState === STATE.DRAGGING) return 'grabbing';
      if (interactionState === STATE.MOVING) return 'grabbing';
      if (hoveredAnchorIdx >= 0) return 'grab';
      if (hoveredDrawingId) return 'pointer';
      return null;
    },
    get selectedDrawingIds() { return selectedDrawingIds; },
    toggleMultiSelect(id) { toggleMultiSelectImpl(getCrudCtx(), id); },
    selectAll() { selectAllImpl(getCrudCtx()); },
    clearMultiSelect() { clearMultiSelectImpl(getCrudCtx()); },
    deleteSelected() { const r = deleteSelectedImpl(getCrudCtx()); if (r) drawings = r; },
    batchUpdateStyle(style) { batchUpdateStyleImpl(getCrudCtx(), style); },
    boxSelect(x1, y1, x2, y2) { boxSelectImpl(getCrudCtx(), x1, y1, x2, y2); },
    copySelected() { clipboard = copySelectedImpl(getCrudCtx()); },
    pasteFromClipboard() { pasteFromClipboardImpl(getCrudCtx(), clipboard); },
    groupSelected() { return groupSelectedImpl(getCrudCtx()); },
    ungroupDrawings(groupId) { ungroupDrawingsImpl(getCrudCtx(), groupId); },
    selectGroup(groupId) { selectGroupImpl(getCrudCtx(), groupId); },
    bulkMove(dx, dy) { bulkMoveImpl(getCrudCtx(), dx, dy); },
    setDrawingLabel(id, label) { setDrawingLabelImpl(getCrudCtx(), id, label); },
    toggleSyncAcrossTimeframes(id) { toggleSyncImpl(getCrudCtx(), id); },

    get state() { return interactionState; },
    addDrawing(drawing) { addDrawingImpl(getCrudCtx(), drawing); },
    removeDrawing(id) { const r = removeDrawingImpl(getCrudCtx(), id); if (r) drawings = r; },
    clearAll() { const r = clearAllImpl(getCrudCtx()); if (r) drawings = r; },
    toggleVisibility(id) { toggleVisibilityImpl(getCrudCtx(), id); },
    toggleLock(id) { toggleLockImpl(getCrudCtx(), id); },
    updateStyle(id, style) { updateStyleImpl(getCrudCtx(), id, style); },
    loadDrawings(drawingArray) { const r = loadDrawingsImpl(getCrudCtx(), drawingArray); if (r) drawings = r; },
    pixelToAnchor,
    anchorToPixel,
    duplicateDrawing(id) { return duplicateDrawingImpl(getCrudCtx(), id); },
    bringToFront(id) { bringToFrontImpl(getCrudCtx(), id); },
    sendToBack(id) { sendToBackImpl(getCrudCtx(), id); },
    get activeDrawing() { return activeDrawing; },
    get version() { return _version; },
    dispose() { drawings = []; activeDrawing = null; activeTool = null; selectedDrawingId = null; },
  };
}
