// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Alert Engine (Sprint 5)
// Bridges drawing tools ↔ alert system.
// Creates dynamic alerts from trendlines, h-lines, channels, zones.
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an alert tied to a drawing.
 * @param {Object} drawing - Drawing object
 * @param {'cross'|'enter'|'exit'} triggerType
 * @param {Object} options - { message, sound, notify }
 * @returns {Object} Alert configuration
 */
export function createDrawingAlert(drawing, triggerType = 'cross', options = {}) {
  const alert = {
    id: `da_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    drawingId: drawing.id,
    drawingType: drawing.type,
    triggerType,
    active: true,
    triggered: false,
    createdAt: Date.now(),
    message: options.message || `Price ${triggerType}ed ${drawing.type}`,
    sound: options.sound ?? true,
    notify: options.notify ?? true,
    points: drawing.points.map(p => ({ ...p })),
  };

  // A1: Dispatch event for store integration — allows useDrawingAlerts hook
  // to persist drawing alerts in useAlertStore so they survive page reload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('charEdge:drawing-alert-created', { detail: alert }));
  }

  return alert;
}

/**
 * Check if price has triggered any drawing alerts.
 * @param {Object[]} alerts - Active drawing alerts
 * @param {number} currentPrice - Current market price
 * @param {number} currentTime - Current timestamp
 * @param {number} prevPrice - Previous bar's close
 * @returns {Object[]} Triggered alerts
 */
export function checkDrawingAlerts(alerts, currentPrice, currentTime, prevPrice) {
  const triggered = [];

  for (const alert of alerts) {
    if (!alert.active || alert.triggered) continue;

    switch (alert.drawingType) {
      case 'hline':
      case 'hray': {
        const level = alert.points[0]?.price;
        if (level == null) continue;
        // Cross detection
        if (alert.triggerType === 'cross') {
          if ((prevPrice <= level && currentPrice > level) || (prevPrice >= level && currentPrice < level)) {
            triggered.push(alert);
          }
        }
        break;
      }

      case 'trendline':
      case 'ray':
      case 'extendedline': {
        // Dynamic trendline: interpolate price at current time
        if (alert.points.length < 2) continue;
        const p1 = alert.points[0];
        const p2 = alert.points[1];
        const timeDiff = p2.time - p1.time;
        if (timeDiff === 0) continue;
        const slope = (p2.price - p1.price) / timeDiff;
        const interpolatedPrice = p1.price + slope * (currentTime - p1.time);

        if (alert.triggerType === 'cross') {
          if ((prevPrice <= interpolatedPrice && currentPrice > interpolatedPrice) ||
              (prevPrice >= interpolatedPrice && currentPrice < interpolatedPrice)) {
            triggered.push(alert);
          }
        }
        break;
      }

      case 'rect':
      case 'alertzone':
      case 'channel': {
        // Zone alerts: enter/exit detection
        if (alert.points.length < 2) continue;
        const upper = Math.max(alert.points[0].price, alert.points[1].price);
        const lower = Math.min(alert.points[0].price, alert.points[1].price);
        const wasInside = prevPrice >= lower && prevPrice <= upper;
        const isInside = currentPrice >= lower && currentPrice <= upper;

        if (alert.triggerType === 'enter' && !wasInside && isInside) {
          triggered.push(alert);
        } else if (alert.triggerType === 'exit' && wasInside && !isInside) {
          triggered.push(alert);
        } else if (alert.triggerType === 'cross' && wasInside !== isInside) {
          triggered.push(alert);
        }
        break;
      }

      case 'fib': {
        // Alert on any Fibonacci level cross
        if (alert.points.length < 2) continue;
        const high = Math.max(alert.points[0].price, alert.points[1].price);
        const low = Math.min(alert.points[0].price, alert.points[1].price);
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        for (const fib of fibLevels) {
          const level = high - fib * (high - low);
          if ((prevPrice <= level && currentPrice > level) || (prevPrice >= level && currentPrice < level)) {
            alert.message = `Price crossed Fib ${(fib * 100).toFixed(1)}% at ${level.toFixed(2)}`;
            triggered.push(alert);
            break;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return triggered;
}

/**
 * Get the appropriate trigger types for a drawing type.
 */
export function getAlertTriggerTypes(drawingType) {
  switch (drawingType) {
    case 'hline':
    case 'hray':
    case 'trendline':
    case 'ray':
    case 'extendedline':
    case 'fib':
      return ['cross'];
    case 'rect':
    case 'alertzone':
    case 'channel':
      return ['enter', 'exit', 'cross'];
    default:
      return ['cross'];
  }
}
