# Getting Started with charEdge

Render your first interactive chart in under 10 lines.

## Quick Start

```jsx
import { ChartEngineWidget } from './app/components/ChartEngineWidget.jsx';

function App() {
  return (
    <ChartEngineWidget
      symbol="BTCUSDT"
      tf="1h"
      chartType="candle"
      showVolume={true}
    />
  );
}
```

That's it. The widget handles data fetching, WebSocket streaming, GPU rendering, and all user interactions.

## Using the Engine Directly

For full control, use `ChartEngine` directly:

```ts
import { ChartEngine } from './charting_library/core/ChartEngine.ts';

const engine = new ChartEngine(document.getElementById('chart')!, {
  callbacks: {
    onCrosshairMove: (data) => console.log(data.price, data.time),
    onBarClick: (price, time) => console.log('Clicked:', price),
  },
  props: {
    symbol: 'BTCUSDT',
    tf: '1h',
    chartType: 'candle',
    showVolume: true,
    theme: 'dark',
  },
});

// Load bar data
const bars = await fetch('/api/binance/klines?symbol=BTCUSDT&interval=1h')
  .then(r => r.json());
engine.setData(bars);

// Add indicators
engine.setIndicators([
  { type: 'ema', period: 20, color: '#FFD700' },
  { type: 'rsi', period: 14, pane: 1 },
]);

// Cleanup on unmount
engine.destroy();
```

## Chart Types

| Type | Value | Description |
|------|-------|-------------|
| Candlestick | `candle` | Traditional OHLC candles |
| Line | `line` | Close-price line chart |
| Area | `area` | Filled area below the line |
| Heikin-Ashi | `heikinashi` | Smoothed trend candles |
| Renko | `renko` | Brick-based trend chart |
| Range Bars | `rangebar` | Fixed-range bars |

## Available Indicators

| Category | Types |
|----------|-------|
| Moving Averages | `sma`, `ema`, `wma`, `dema`, `tema`, `vwap` |
| Oscillators | `rsi`, `stochastic`, `cci`, `williamsR`, `mfi`, `roc` |
| Trend | `macd`, `adx`, `ichimoku`, `supertrend`, `parabolicSar` |
| Volatility | `bollingerBands`, `atr`, `keltnerChannels`, `donchianChannels` |
| Volume | `obv`, `volumeOscillator`, `volumeSpikes`, `volumeDelta` |

## Configuration

Key props you can pass to `setProps()`:

```ts
engine.setProps({
  chartType: 'candle',      // Chart rendering type
  showVolume: true,          // Show volume bars
  showHeatmap: false,        // Order flow heatmap
  magnetMode: true,          // Snap drawings to OHLC
  theme: 'dark',             // 'dark' | 'light' | 'midnight'
  compact: false,            // Compact mode for small containers
  useUTC: false,             // UTC vs local time axis
});
```

## Next Steps

- See [ARCHITECTURE.md](./ARCHITECTURE.md) for the render pipeline architecture
- See [THEME_GUIDE.md](./THEME_GUIDE.md) for customizing colors and styles
- See [DEV_WORKFLOW.md](./DEV_WORKFLOW.md) for development setup
