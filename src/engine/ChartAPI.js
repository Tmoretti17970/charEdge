// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartAPI (Task 5.2.1)
//
// Typed public interface for the chart engine. Wraps Zustand store
// actions with validation and provides a clean, documented API
// surface for external consumers or plugin authors.
//
// Usage:
//   import { ChartAPI } from './ChartAPI.js';
//   const api = ChartAPI.create(useChartStore);
//   api.setSymbol('ETH');
//   api.addIndicator({ type: 'sma', params: { period: 20 } });
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {import('../state/useChartStore.js').default} ChartStore
 */

/**
 * @typedef {object} IndicatorConfig
 * @property {string} type - Indicator type (e.g. 'sma', 'ema', 'rsi', 'macd', 'bbands')
 * @property {Record<string, any>} [params] - Indicator-specific parameters
 * @property {boolean} [visible] - Whether the indicator is visible (default: true)
 * @property {string} [color] - Override color for the indicator line
 */

/**
 * @typedef {object} ChartAPIInstance
 * @property {(symbol: string) => void} setSymbol
 * @property {() => string} getSymbol
 * @property {(interval: string) => void} setInterval
 * @property {() => string} getInterval
 * @property {(config: IndicatorConfig) => string} addIndicator
 * @property {(id: string) => void} removeIndicator
 * @property {() => Array<IndicatorConfig & {id: string}>} getIndicators
 * @property {() => Array<{t: number, o: number, h: number, l: number, c: number, v: number}>} getVisibleBars
 * @property {(event: string, handler: Function) => () => void} subscribe
 * @property {() => void} destroy
 */

const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

/**
 * Create a typed, validated chart API instance wrapping a Zustand store.
 *
 * @param {ChartStore} store - The Zustand chart store
 * @returns {ChartAPIInstance}
 */
function createChartAPI(store) {
    const listeners = new Map();
    let listenerCount = 0;

    /**
     * Set the active chart symbol.
     * @param {string} symbol - e.g. 'BTC', 'ETH', 'AAPL'
     */
    function setSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            throw new TypeError(`ChartAPI.setSymbol: invalid symbol "${symbol}"`);
        }
        store.getState().setSymbol(symbol);
    }

    /** @returns {string} Current symbol */
    function getSymbol() {
        return store.getState().symbol;
    }

    /**
     * Set the chart time interval.
     * @param {string} interval - e.g. '1m', '5m', '1h', '1d'
     */
    function setInterval(interval) {
        if (!VALID_INTERVALS.includes(interval)) {
            throw new RangeError(
                `ChartAPI.setInterval: invalid interval "${interval}". Valid: ${VALID_INTERVALS.join(', ')}`,
            );
        }
        store.getState().setInterval(interval);
    }

    /** @returns {string} Current interval */
    function getInterval() {
        return store.getState().interval;
    }

    /**
     * Add an indicator to the chart.
     * @param {IndicatorConfig} config
     * @returns {string} Unique indicator ID
     */
    function addIndicator(config) {
        if (!config || !config.type || typeof config.type !== 'string') {
            throw new TypeError('ChartAPI.addIndicator: config.type is required');
        }
        const state = store.getState();
        if (typeof state.addIndicator === 'function') {
            return state.addIndicator(config);
        }
        // Fallback: manual addition
        const id = `ind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const indicators = [...(state.indicators || []), { ...config, id, visible: config.visible ?? true }];
        store.setState({ indicators });
        return id;
    }

    /**
     * Remove an indicator by ID.
     * @param {string} id
     */
    function removeIndicator(id) {
        if (!id) throw new TypeError('ChartAPI.removeIndicator: id is required');
        const state = store.getState();
        if (typeof state.removeIndicator === 'function') {
            state.removeIndicator(id);
        } else {
            const indicators = (state.indicators || []).filter((i) => i.id !== id);
            store.setState({ indicators });
        }
    }

    /**
     * Get all active indicators.
     * @returns {Array<IndicatorConfig & {id: string}>}
     */
    function getIndicators() {
        return store.getState().indicators || [];
    }

    /**
     * Get the currently visible bars on the chart.
     * @returns {Array<{t: number, o: number, h: number, l: number, c: number, v: number}>}
     */
    function getVisibleBars() {
        return store.getState().bars || [];
    }

    /**
     * Subscribe to store state changes.
     * @param {string} event - Event name (e.g. 'symbol', 'interval', 'bars', '*')
     * @param {Function} handler - Callback
     * @returns {() => void} Unsubscribe function
     */
    function subscribe(event, handler) {
        const id = ++listenerCount;
        if (!listeners.has(event)) listeners.set(event, new Map());
        listeners.get(event).set(id, handler);

        // Use Zustand's subscribe for store-level changes
        const unsub = store.subscribe((state, prevState) => {
            if (event === '*' || state[event] !== prevState[event]) {
                handler(state[event], prevState[event], state);
            }
        });

        return () => {
            listeners.get(event)?.delete(id);
            unsub();
        };
    }

    /** Clean up all subscriptions. */
    function destroy() {
        listeners.clear();
    }

    return {
        setSymbol,
        getSymbol,
        setInterval,
        getInterval,
        addIndicator,
        removeIndicator,
        getIndicators,
        getVisibleBars,
        subscribe,
        destroy,
    };
}

/**
 * Factory: create a ChartAPI from a Zustand chart store.
 * @param {ChartStore} store
 * @returns {ChartAPIInstance}
 */
const ChartAPI = {
    create: createChartAPI,
};

export { ChartAPI, createChartAPI };
export default ChartAPI;
