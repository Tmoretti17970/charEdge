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
      output: {
        manualChunks(id) {
          // ── Vendor splits ──────────────────────────────────────
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/zustand/')) {
            return 'vendor-zustand';
          }

          // ── Feature splits ─────────────────────────────────────
          if (id.includes('src/pages/CommunityPage')) {
            return 'community';
          }
          if (id.includes('src/charting_library/') || id.includes('src/engine/')) {
            return 'data-engines';
          }
          if (id.includes('src/data/') && !id.includes('__tests__')) {
            return 'data-adapters';
          }
          if (id.includes('src/pages/CoachPage') || id.includes('src/services/ai')) {
            return 'ai-coach';
          }
          if (id.includes('src/pages/InsightsPage') || id.includes('src/pages/TelemetryDashboard')) {
            return 'analytics';
          }
          if (id.includes('src/pages/ChartsPage') || id.includes('src/pages/MarketsPage')) {
            return 'chart-panels';
          }
          if (id.includes('src/app/features/chart') || id.includes('src/app/components/chart')) {
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
    include: ['src/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    css: {
      modules: { classNameStrategy: 'non-scoped' },
    },
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
