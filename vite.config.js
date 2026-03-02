import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/binance': {
        target: 'https://data-api.binance.vision',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/binance/, '/api')
      },
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, '/v8/finance'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, '')
      },
      '/api/cryptocompare': {
        target: 'https://min-api.cryptocompare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cryptocompare/, '')
      }
    }
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Optional monitoring SDKs — dynamically imported when env vars are set.
      // Mark external so build succeeds even when not installed.
      external: ['@sentry/browser', 'posthog-js'],
      output: {
        manualChunks(id) {
          // Vendor: React core
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Vendor: framer-motion (large animation lib, rarely changes)
          if (id.includes('node_modules/framer-motion/') ||
              id.includes('node_modules/motion/')) {
            return 'vendor-motion';
          }
          // Vendor: zustand (state management)
          if (id.includes('node_modules/zustand/')) {
            return 'vendor-zustand';
          }
          // Vendor: other node_modules
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
          // Community / social features
          if (id.includes('/social/') ||
              id.includes('/community/') ||
              id.includes('CommunityPage') ||
              id.includes('SocialFeed') ||
              id.includes('Leaderboard')) {
            return 'community';
          }
          // P2P / community data engines
          if (id.includes('/data/engine/Peer') ||
              id.includes('/data/engine/Sentiment') ||
              id.includes('/data/engine/TradeHeatmap') ||
              id.includes('/data/engine/CommunitySignal') ||
              id.includes('/data/engine/DataRelay') ||
              id.includes('/data/engine/OrderFlow') ||
              id.includes('/data/engine/DepthEngine') ||
              id.includes('/data/engine/VolumeProfile')) {
            return 'data-engines';
          }
          // Data adapters
          if (id.includes('/data/adapters/')) {
            return 'data-adapters';
          }
          // AI Coach (H2.3 — coaching engine, pre-trade, summaries)
          if (id.includes('/ai/') ||
              id.includes('CoachPage') ||
              id.includes('/coach/')) {
            return 'ai-coach';
          }
          // Analytics (heavy computation, only needed on journal page)
          if (id.includes('/analytics/') ||
              id.includes('analyticsSingleton') ||
              id.includes('monteCarloSim')) {
            return 'analytics';
          }
          // Chart panels (lazy-loaded slide-in panels)
          if (id.includes('/panels/') ||
              id.includes('DrawingSidebar') ||
              id.includes('DataQualityIndicator') ||
              id.includes('LiveTicker')) {
            return 'chart-panels';
          }
          // Chart tools: backtester, strategy, analysis
          if (id.includes('BacktestPanel') ||
              id.includes('BacktestResults') ||
              id.includes('StrategyBuilder') ||
              id.includes('ChartAnalysis') ||
              id.includes('WalkForward') ||
              id.includes('FuturesAnalytics')) {
            return 'chart-tools';
          }
        },
      },
    },
  },
  // SSR build: vite build --ssr src/entry-server.jsx --outDir dist/server
  ssr: {
    noExternal: [],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/utils.js', 'src/csv.js', 'src/state/**', 'src/data/**', 'src/constants.js'],
      exclude: ['src/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
    sequence: { shuffle: false },
  },
});
