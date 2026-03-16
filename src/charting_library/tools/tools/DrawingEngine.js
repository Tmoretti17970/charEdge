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
//   DrawingHistory.js  — undo/redo snapshot stack
// ═══════════════════════════════════════════════════════════════════

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
import { hitTestDrawingBody, hitTestNearest as hitTestNearestImpl } from '../engines/DrawingHitTest.js';
import {
  doMagnetSnap as doMagnetSnapImpl,
  applyAngleSnap as applyAngleSnapImpl,
  getSmartGuides as getSmartGuidesImpl,
} from '../engines/DrawingSnap.js';
import { createDrawing, TOOL_POINT_COUNT } from './DrawingModel.js';
import { RESIZABLE_TOOLS, computeResizeHandles, hitTestResizeHandle, applyHandleDrag } from '../engines/ResizeHandles.js';
import { createDrawingHistory } from '../engines/DrawingHistory.js';
import { createDrawingAlertService } from '../engines/DrawingAlertService.js';

// ── Sub-modules ──────────────────────────────────────────────────

/** Interaction states */
const STATE = {
  IDLE: 'idle',
  CREATING: 'creating',
  SELECTED: 'selected',
  DRAGGING: 'dragging',
  MOVING: 'moving',
  RESIZING: 'resizing',
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
  const selectedDrawingIds = new Set();
  let hoveredDrawingId = null;
  let hoveredAnchorIdx = -1;
  let dragAnchorIdx = -1;
  let _dragStartPrice = 0;
  let _dragStartTime = 0;
  let dragPointOffsets = [];
  let _multiDragOffsets = null; // Map<drawingId, offsets[]> for multi-select drag
  let clipboard = null;

  // Undo/redo history
  const _history = createDrawingHistory();
  function pushHistory() { if (_history) _history.push(drawings); }

  // Drawing alert service
  const _alertService = createDrawingAlertService({
    getDrawings: () => drawings,
    anchorToPixel,
    onAlert: (event) => {
      window.dispatchEvent(new CustomEvent('charEdge:drawing-alert', { detail: event }));
    },
  });

  // Resize handle state
  let _resizeHandleType = null;  // which handle ('tl','tr','bl','br','t','b','l','r')
  let _resizeOrigPoints = null;  // original anchor points snapshot
  let _hoveredResizeHandle = null; // for cursor + glow feedback

  // Drag momentum / inertia state
  let _velocityHistory = [];      // last 3 { x, y, t } entries
  let _coastAnimId = null;        // rAF id for coast loop

  // ── Sticky mode ──
  let stickyMode = false;
  let stickyToolType = null;
  let stickyStyleOverrides = {};
  const toolStyleMemory = {};

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
  let snapStrength = 0;
  let snapEnabled = true;   // Magnet snap on/off toggle
  let angleSnap = false;
  let smartGuides = true;
  let lastSnapInfo = null;
  let _visibleBars = [];

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
    // Sprint 9: Alt key temporarily disables magnet snap
    if (!snapEnabled || (_lastMouseEvent && _lastMouseEvent.altKey)) {
      lastSnapInfo = null;
      return { price, time };
    }
    const result = doMagnetSnapImpl({
      x, y, price, time, snapStrength, magnetSnap,
      drawings, activeDrawing, anchorToPixel, priceToPixel,
      indicatorData: _indicatorData, hoverBarIdx: _hoverBarIdx, gridTicks: _gridTicks,
      visibleBars: _visibleBars,
    });
    // Enrich snapInfo with pixel coordinates for visual indicator
    if (result.snapInfo && priceToPixel && timeToPixel) {
      result.snapInfo.px = timeToPixel(result.time) || x;
      result.snapInfo.py = priceToPixel(result.price) || y;
    } else if (result.snapInfo) {
      result.snapInfo.px = x;
      result.snapInfo.py = y;
    }
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

  function onMouseDown(x, y, event) {
    if (event) _lastMouseEvent = event;
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
        pushHistory();
        if (stickyMode && stickyToolType) {
          activeDrawing = null;
          activeTool = stickyToolType;
          activeDrawing = createDrawing(stickyToolType, null, stickyStyleOverrides);
          activeDrawing._confirmedPoints = 0;
          drawings.push(activeDrawing);
          setState(STATE.CREATING);
        } else {
          // Sprint 6: auto-select completed drawing so QuickEditor shows
          const completedId = activeDrawing.id;
          activeDrawing = null;
          activeTool = null;
          selectedDrawingId = completedId;
          drawings.forEach(d => (d.state = d.id === completedId ? 'selected' : 'idle'));
          setState(STATE.SELECTED);
        }
      }
      emit();
      return true;
    }

    // ── Check resize handles FIRST if a shape is selected ──
    if (selectedDrawingId) {
      const selDraw = drawings.find(d => d.id === selectedDrawingId);
      if (selDraw && RESIZABLE_TOOLS.has(selDraw.type) && !selDraw.locked) {
        const pts = selDraw.points.map(p => anchorToPixel(p)).filter(Boolean);
        if (pts.length >= 2) {
          const handles = computeResizeHandles(pts);
          const handleHit = hitTestResizeHandle(handles, x, y);
          if (handleHit) {
            _resizeHandleType = handleHit.type;
            _resizeOrigPoints = selDraw.points.map(p => ({ ...p }));
            setState(STATE.RESIZING);
            emit();
            return true;
          }
        }
      }
    }

    // ── Alt+drag to clone ──
    if (_lastMouseEvent && _lastMouseEvent.altKey && selectedDrawingId && (interactionState === STATE.SELECTED || interactionState === STATE.IDLE)) {
      const selDraw = drawings.find(d => d.id === selectedDrawingId);
      if (selDraw && !selDraw.locked) {
        const body = hitTestDrawingBody(selDraw, x, y, anchorToPixel);
        if (body) {
          const clonedId = duplicateDrawingImpl(getCrudCtx(), selectedDrawingId);
          if (clonedId) {
            const clonedDrawing = drawings.find(d => d.id === clonedId);
            if (clonedDrawing) {
              selDraw.state = 'idle';
              selectedDrawingId = clonedId;
              clonedDrawing.state = 'selected';
              const anchor = pixelToAnchor(x, y);
              dragPointOffsets = clonedDrawing.points.map(p => ({ dPrice: p.price - anchor.price, dTime: p.time - anchor.time }));
              setState(STATE.MOVING);
              emit();
              return true;
            }
          }
        }
      }
    }

    const hit = hitTest(x, y);
    if (hit) {
      const isShift = _lastMouseEvent && _lastMouseEvent.shiftKey;

      if (isShift) {
        // ── Multi-select: Shift+Click toggles drawing in/out ──
        if (selectedDrawingIds.has(hit.drawing.id)) {
          selectedDrawingIds.delete(hit.drawing.id);
          hit.drawing.state = 'idle';
          // If removed the primary, pick another or clear
          if (selectedDrawingId === hit.drawing.id) {
            selectedDrawingId = selectedDrawingIds.size > 0 ? [...selectedDrawingIds][0] : null;
          }
        } else {
          selectedDrawingIds.add(hit.drawing.id);
          hit.drawing.state = 'selected';
          // Also keep in primary
          if (!selectedDrawingId) selectedDrawingId = hit.drawing.id;
        }
        drawings.forEach(d => {
          d.state = selectedDrawingIds.has(d.id) || d.id === selectedDrawingId ? 'selected' : 'idle';
        });
        setState(selectedDrawingIds.size > 0 ? STATE.SELECTED : STATE.IDLE);
        emit();
        return true;
      }

      // ── Single-click (no Shift) ──
      selectedDrawingIds.clear();
      selectedDrawingId = hit.drawing.id;
      drawings.forEach(d => (d.state = d.id === selectedDrawingId ? 'selected' : 'idle'));
      if (hit.anchorIdx >= 0 && !hit.drawing.locked) {
        dragAnchorIdx = hit.anchorIdx;
        setState(STATE.DRAGGING);
      } else if (!hit.drawing.locked) {
        const anchor = pixelToAnchor(x, y);
        _dragStartPrice = anchor.price;
        _dragStartTime = anchor.time;
        // Store offsets for primary + multi-selected drawings
        _multiDragOffsets = new Map();
        const allSelectedIds = new Set([selectedDrawingId, ...selectedDrawingIds]);
        for (const id of allSelectedIds) {
          const d = drawings.find(dd => dd.id === id);
          if (d && !d.locked) {
            _multiDragOffsets.set(id, d.points.map(p => ({ dPrice: p.price - anchor.price, dTime: p.time - anchor.time })));
          }
        }
        dragPointOffsets = hit.drawing.points.map(p => ({ dPrice: p.price - anchor.price, dTime: p.time - anchor.time }));
        setState(STATE.MOVING);
      } else {
        setState(STATE.SELECTED);
      }
      emit();
      // Open the consolidated edit popup on single-click selection
      window.dispatchEvent(new CustomEvent('charEdge:edit-drawing', {
        detail: {
          id: hit.drawing.id, type: hit.drawing.type,
          points: hit.drawing.points.map(p => ({ ...p })),
          style: { ...hit.drawing.style },
          meta: hit.drawing.meta ? { ...hit.drawing.meta } : {},
          locked: hit.drawing.locked, visible: hit.drawing.visible,
          syncAcrossTimeframes: hit.drawing.syncAcrossTimeframes,
          pixelX: x, pixelY: y,
        },
      }));
      return true;
    }

    if (selectedDrawingId || selectedDrawingIds.size > 0) {
      selectedDrawingId = null;
      selectedDrawingIds.clear();
      drawings.forEach(d => (d.state = 'idle'));
      setState(STATE.IDLE);
      emit();
    }
    return false;
  }

  function onMouseMove(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing) {
      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      // 1-point tools finalize on click — no ghost preview needed
      if (neededPoints === 1) return true;
      const rawAnchor = pixelToAnchor(x, y);
      const anchor = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);
      // Use _confirmedPoints (not points.length) — the ghost point makes
      // points.length === neededPoints, but we still need to update it
      // until the user clicks to confirm.
      if (activeDrawing._confirmedPoints > 0 && activeDrawing._confirmedPoints < neededPoints) {
        if (activeDrawing.points.length === activeDrawing._confirmedPoints) {
          activeDrawing.points.push(anchor);
        } else {
          activeDrawing.points[activeDrawing._confirmedPoints] = anchor;
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
      const anchor = pixelToAnchor(x, y);

      // Move all multi-selected drawings together
      if (_multiDragOffsets && _multiDragOffsets.size > 0) {
        for (const [id, offsets] of _multiDragOffsets) {
          const d = drawings.find(dd => dd.id === id);
          if (d) {
            for (let i = 0; i < d.points.length && i < offsets.length; i++) {
              d.points[i] = { price: anchor.price + offsets[i].dPrice, time: anchor.time + offsets[i].dTime };
            }
          }
        }
      } else {
        // Single-drawing fallback
        const drawing = drawings.find(d => d.id === selectedDrawingId);
        if (drawing) {
          for (let i = 0; i < drawing.points.length; i++) {
            drawing.points[i] = { price: anchor.price + dragPointOffsets[i].dPrice, time: anchor.time + dragPointOffsets[i].dTime };
          }
        }
      }
      // Track velocity for momentum
      const now = performance.now();
      _velocityHistory.push({ x, y, t: now });
      if (_velocityHistory.length > 4) _velocityHistory.shift();
      emit();
      return true;
    }

    // ── Resize handle drag (with snap) ──
    if (interactionState === STATE.RESIZING && selectedDrawingId && _resizeHandleType && _resizeOrigPoints) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing) {
        const rawAnchor = pixelToAnchor(x, y);
        const snappedAnchor = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);
        const newPoints = applyHandleDrag(_resizeHandleType, _resizeOrigPoints, snappedAnchor);
        drawing.points = newPoints;
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

      // Resize handle hover detection
      if (selectedDrawingId) {
        const selDraw = drawings.find(d => d.id === selectedDrawingId);
        if (selDraw && RESIZABLE_TOOLS.has(selDraw.type)) {
          const pts = selDraw.points.map(p => anchorToPixel(p)).filter(Boolean);
          if (pts.length >= 2) {
            const handles = computeResizeHandles(pts);
            const handleHit = hitTestResizeHandle(handles, x, y);
            const newHovered = handleHit ? handleHit.type : null;
            if (newHovered !== _hoveredResizeHandle) {
              _hoveredResizeHandle = newHovered;
              emit();
            }
          }
        } else if (_hoveredResizeHandle) {
          _hoveredResizeHandle = null;
          emit();
        }
      } else if (_hoveredResizeHandle) {
        _hoveredResizeHandle = null;
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
              // Sprint 6: auto-select completed drawing
              const completedId = activeDrawing.id;
              activeDrawing = null;
              activeTool = null;
              selectedDrawingId = completedId;
              drawings.forEach(d => (d.state = d.id === completedId ? 'selected' : 'idle'));
              setState(STATE.SELECTED);
            }
          }
          emit();
          return true;
        }
      }
    }
    if (interactionState === STATE.DRAGGING || interactionState === STATE.MOVING || interactionState === STATE.RESIZING) {
      if (interactionState === STATE.RESIZING) {
        _resizeHandleType = null;
        _resizeOrigPoints = null;
      }
      // ── Momentum coast for MOVING ──
      if (interactionState === STATE.MOVING && selectedDrawingId && _velocityHistory.length >= 2) {
        const last = _velocityHistory[_velocityHistory.length - 1];
        const prev = _velocityHistory[_velocityHistory.length - 2];
        const dt = (last.t - prev.t) || 16;
        let vx = (last.x - prev.x) / dt * 16;
        let vy = (last.y - prev.y) / dt * 16;
        const FRICTION = 0.92;
        const MIN_V = 0.3;
        const drawing = drawings.find(d => d.id === selectedDrawingId);
        if (drawing && (Math.abs(vx) > MIN_V || Math.abs(vy) > MIN_V)) {
          const coast = () => {
            vx *= FRICTION;
            vy *= FRICTION;
            if (Math.abs(vx) < MIN_V && Math.abs(vy) < MIN_V) {
              _coastAnimId = null;
              return;
            }
            for (let i = 0; i < drawing.points.length; i++) {
              const px = anchorToPixel(drawing.points[i]);
              if (!px) continue;
              const np = pixelToAnchor(px.x + vx, px.y + vy);
              drawing.points[i] = { price: np.price, time: np.time };
            }
            emit();
            _coastAnimId = requestAnimationFrame(coast);
          };
          _coastAnimId = requestAnimationFrame(coast);
        }
      }
      _velocityHistory = [];
      pushHistory();
      setState(selectedDrawingId ? STATE.SELECTED : STATE.IDLE);
      dragAnchorIdx = -1;
      emit();
      return true;
    }
    return false;
  }

  function onDoubleClick(x, y) {
    // BUG-03: Finalize polyline (Infinity point count) with double-click
    if (interactionState === STATE.CREATING && activeDrawing) {
      const needed = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      if (needed === Infinity && activeDrawing._confirmedPoints >= 2) {
        activeDrawing.points.length = activeDrawing._confirmedPoints;
        if (activeDrawing.type && activeDrawing.style) toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
        activeDrawing.state = 'selected';
        // Sprint 6: auto-select completed polyline
        const completedId = activeDrawing.id;
        selectedDrawingId = completedId;
        activeDrawing = null;
        activeTool = null;
        setState(STATE.SELECTED);
        emit();
        return true;
      }
    }
    const hit = hitTest(x, y);
    if (!hit) return false;
    const drawing = hit.drawing;
    if (drawing.type === 'text' || drawing.type === 'callout' || drawing.type === 'note' || drawing.type === 'signpost') {
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

  // Track altKey for alt-drag
  let _lastMouseEvent = null;

  function onKeyDown(key, event) {
    if (event) _lastMouseEvent = event;
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
    // BUG-03: Finalize polyline (Infinity point count) with Enter key
    if (key === 'Enter' && interactionState === STATE.CREATING && activeDrawing) {
      const needed = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      if (needed === Infinity && activeDrawing._confirmedPoints >= 2) {
        activeDrawing.points.length = activeDrawing._confirmedPoints;
        if (activeDrawing.type && activeDrawing.style) toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
        activeDrawing.state = 'selected';
        // Sprint 6: auto-select completed polyline
        const completedId = activeDrawing.id;
        selectedDrawingId = completedId;
        activeDrawing = null;
        activeTool = null;
        setState(STATE.SELECTED);
        emit();
        return true;
      }
    }
    // Ctrl+A / Cmd+A: Select all visible drawings
    if (key === 'a' && event && (event.ctrlKey || event.metaKey) && interactionState !== STATE.CREATING) {
      event.preventDefault();
      selectedDrawingIds.clear();
      for (const d of drawings) {
        if (d.visible && d.state !== 'creating') {
          selectedDrawingIds.add(d.id);
          d.state = 'selected';
        }
      }
      if (selectedDrawingIds.size > 0) {
        selectedDrawingId = [...selectedDrawingIds][0];
        setState(STATE.SELECTED);
      }
      emit();
      return true;
    }
    if ((key === 'Delete' || key === 'Backspace') && (selectedDrawingId || selectedDrawingIds.size > 0)) {
      // Multi-delete: remove all selected
      const idsToRemove = new Set([...selectedDrawingIds]);
      if (selectedDrawingId) idsToRemove.add(selectedDrawingId);
      drawings = drawings.filter(d => !idsToRemove.has(d.id));
      selectedDrawingId = null;
      selectedDrawingIds.clear();
      pushHistory();
      setState(STATE.IDLE); emit(); return true;
    }
    // Arrow nudge: 1px, Shift = 10px — applies to all selected
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) && (selectedDrawingId || selectedDrawingIds.size > 0)) {
      const allIds = new Set([...selectedDrawingIds]);
      if (selectedDrawingId) allIds.add(selectedDrawingId);
      const step = (event && event.shiftKey) ? 10 : 1;
      const dx = key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0;
      const dy = key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0;
      let moved = false;
      for (const id of allIds) {
        const d = drawings.find(dd => dd.id === id);
        if (d && !d.locked) {
          for (let i = 0; i < d.points.length; i++) {
            const px = anchorToPixel(d.points[i]);
            if (!px) continue;
            const np = pixelToAnchor(px.x + dx, px.y + dy);
            d.points[i] = { price: np.price, time: np.time };
          }
          moved = true;
        }
      }
      if (moved) { pushHistory(); emit(); return true; }
    }
    // Ctrl+D: duplicate
    if (key === 'd' && selectedDrawingId) {
      const newId = duplicateDrawingImpl(getCrudCtx(), selectedDrawingId);
      if (newId) { selectedDrawingId = newId; pushHistory(); emit(); }
      return true;
    }
    // Ctrl+L: toggle lock
    if (key === 'l' && selectedDrawingId) {
      toggleLockImpl(getCrudCtx(), selectedDrawingId);
      emit(); return true;
    }
    // Ctrl+H: toggle visibility
    if (key === 'h' && selectedDrawingId) {
      toggleVisibilityImpl(getCrudCtx(), selectedDrawingId);
      emit(); return true;
    }
    // [ / ]: layer ordering
    if (key === '[' && selectedDrawingId) {
      sendToBackImpl(getCrudCtx(), selectedDrawingId);
      emit(); return true;
    }
    if (key === ']' && selectedDrawingId) {
      bringToFrontImpl(getCrudCtx(), selectedDrawingId);
      emit(); return true;
    }
    // Undo: Ctrl+Z
    if (key === 'z' && _history && _history.canUndo()) {
      const snapshot = _history.undo();
      if (snapshot) {
        drawings = snapshot;
        selectedDrawingId = null;
        activeDrawing = null;
        setState(STATE.IDLE); emit();
      }
      return true;
    }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if ((key === 'Z' || key === 'y') && _history && _history.canRedo()) {
      const snapshot = _history.redo();
      if (snapshot) {
        drawings = snapshot;
        selectedDrawingId = null;
        activeDrawing = null;
        setState(STATE.IDLE); emit();
      }
      return true;
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
    setSnapStrength(val) { snapStrength = Math.max(0, Math.min(50, val)); },
    setSnapEnabled(val) { snapEnabled = !!val; },
    get isSnapEnabled() { return snapEnabled; },
    setAngleSnap(val) { angleSnap = val; },
    setSmartGuides(val) { smartGuides = val; },
    getSmartGuides(x, y) { return getSmartGuidesImpl(smartGuides, x, y, drawings, activeDrawing, anchorToPixel); },
    applyAngleSnap(startPx, endX, endY) { return applyAngleSnapImpl(angleSnap, startPx, endX, endY); },
    get lastSnapInfo() { return lastSnapInfo; },

    // ── Advanced snap data sources ──
    setIndicatorData(indicators) { _indicatorData = indicators || []; },
    setHoverBarIdx(idx) { _hoverBarIdx = idx; },
    setGridTicks(ticks) { _gridTicks = ticks || []; },
    setVisibleBars(bars) { _visibleBars = bars || []; },

    // ── Event handlers ──
    onMouseDown, onMouseMove, onMouseUp, onDoubleClick, onKeyDown,

    // ── Drawing management (delegated to DrawingCRUD) ──
    get drawings() { return drawings; },
    get selectedDrawing() { return selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null; },
    get hoveredDrawingId() { return hoveredDrawingId; },
    get hoveredAnchorIdx() { return hoveredAnchorIdx; },
    get pixelToPrice() { return pixelToPrice; },
    get pixelToTime() { return pixelToTime; },
    setSceneGraph(sg) { _sceneGraph = sg; },
    hitTestNearest(x, y) { return hitTestNearestImpl(drawings, x, y, anchorToPixel); },
    // Task 1.4.9: Per-tool cursor shapes — cursor changes based on active drawing tool
    get cursorHint() {
      if (interactionState === STATE.CREATING) {
        const toolCursors = {
          trendline: 'crosshair', ray: 'crosshair', segment: 'crosshair',
          hline: 'crosshair', vline: 'crosshair',
          rectangle: 'cell', ellipse: 'cell',
          text: 'text', callout: 'text',
          fib: 'crosshair', fibext: 'crosshair', fibarc: 'crosshair',
          pitchfork: 'crosshair',
          ruler: 'copy', pricerange: 'copy',
          arrow_up: 'crosshair', arrow_down: 'crosshair',
        };
        return (activeTool && toolCursors[activeTool]) || 'crosshair';
      }
      if (interactionState === STATE.DRAGGING || interactionState === STATE.RESIZING) return 'grabbing';
      if (interactionState === STATE.MOVING) return 'grabbing';
      if (_hoveredResizeHandle) {
        const HANDLE_CURSORS = { tl:'nwse-resize', tr:'nesw-resize', bl:'nesw-resize', br:'nwse-resize', t:'ns-resize', b:'ns-resize', l:'ew-resize', r:'ew-resize' };
        return HANDLE_CURSORS[_hoveredResizeHandle] || 'pointer';
      }
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
    /** Returns bounding box of selected drawing in CSS (non-retina) pixel coords */
    getSelectedBounds() {
      const sel = selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;
      if (!sel || !sel.points || sel.points.length === 0) return null;
      const pxPts = sel.points.map(p => anchorToPixel(p)).filter(Boolean);
      if (pxPts.length === 0) return null;
      let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
      for (const p of pxPts) {
        if (p.x < left) left = p.x;
        if (p.x > right) right = p.x;
        if (p.y < top) top = p.y;
        if (p.y > bottom) bottom = p.y;
      }
      return { top, left, right, bottom };
    },
    get version() { return _version; },
    get _hoveredResizeHandle() { return _hoveredResizeHandle; },
    dispose() {
      if (_coastAnimId) cancelAnimationFrame(_coastAnimId);
      if (_history) _history.clear();
      drawings = []; activeDrawing = null; activeTool = null; selectedDrawingId = null;
      _resizeHandleType = null; _resizeOrigPoints = null; _hoveredResizeHandle = null;
      _velocityHistory = []; _coastAnimId = null;
    },
    // Undo/Redo API
    undo() {
      if (!_history || !_history.canUndo()) return false;
      const snapshot = _history.undo();
      if (snapshot) { drawings = snapshot; selectedDrawingId = null; activeDrawing = null; setState(STATE.IDLE); emit(); }
      return true;
    },
    redo() {
      if (!_history || !_history.canRedo()) return false;
      const snapshot = _history.redo();
      if (snapshot) { drawings = snapshot; selectedDrawingId = null; activeDrawing = null; setState(STATE.IDLE); emit(); }
      return true;
    },
    canUndo() { return _history ? _history.canUndo() : false; },
    canRedo() { return _history ? _history.canRedo() : false; },
    pushHistory() { pushHistory(); },

    // Alert API
    enableAlert(id, opts) { _alertService.enableAlert(id, opts); },
    disableAlert(id) { _alertService.disableAlert(id); },
    hasAlert(id) { return _alertService.hasAlert(id); },
    getAlertedIds() { return _alertService.getAlertedIds(); },
    onPriceTick(price) { _alertService.onPriceTick(price); },

    // Multi-select API
    getSelectedIds() {
      const ids = new Set([...selectedDrawingIds]);
      if (selectedDrawingId) ids.add(selectedDrawingId);
      return [...ids];
    },
    reorderDrawing(id, newIndex) {
      const idx = drawings.findIndex(d => d.id === id);
      if (idx < 0 || newIndex < 0 || newIndex >= drawings.length) return;
      const [removed] = drawings.splice(idx, 1);
      drawings.splice(newIndex, 0, removed);
      pushHistory(); emit();
    },
    getDrawingsByGroup() {
      const map = new Map();
      for (const d of drawings) {
        const gid = d._groupId || '__ungrouped';
        if (!map.has(gid)) map.set(gid, []);
        map.get(gid).push(d);
      }
      return map;
    },
  };
}
