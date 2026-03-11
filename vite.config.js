import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CDN Strategy: Modulepreload Hints Plugin (Task 3.2.12) ─────
// Injects <link rel="modulepreload"> for critical lazy-loaded chunks
// that Vite wouldn't normally preload (they're behind dynamic import).
function modulepreloadPlugin() {
  const CRITICAL_CHUNKS = ['vendor-react', 'vendor-zustand', 'data-engines', 'chart-tools'];
  return {
    name: 'charEdge-modulepreload',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const links = [];
      for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
        if (chunk.type !== 'chunk') continue;
        const matchesCritical = CRITICAL_CHUNKS.some(name =>
          fileName.includes(name) || chunk.name === name
        );
        if (matchesCritical) {
          links.push({
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              href: `/${fileName}`,
              crossorigin: true,
            },
            injectTo: 'head',
          });
        }
      }
      return links;
    },
  };
}

// ─── API Proxy Plugin (Dev Only) ────────────────────────────────
// Handles /api/proxy/{provider}/* in dev mode, injecting API keys
// from .env.local server-side. Mirrors Vercel serverless functions.
function apiProxyPlugin() {
  const PROXY_CONFIGS = {
    alpaca: { base: 'https://data.alpaca.markets', authStyle: 'header', envKeys: { keyId: 'ALPACA_KEY_ID', secret: 'ALPACA_SECRET' }, headerMap: { keyId: 'APCA-API-KEY-ID', secret: 'APCA-API-SECRET-KEY' }, cache: 5 },
    polygon: { base: 'https://api.polygon.io', envKey: 'POLYGON_API_KEY', paramName: 'apiKey', cache: 5 },
    alphavantage: { base: 'https://www.alphavantage.co', envKey: 'ALPHAVANTAGE_API_KEY', paramName: 'apikey', cache: 30 },
    fmp: { base: 'https://financialmodelingprep.com/api/v3', envKey: 'FMP_API_KEY', paramName: 'apikey', cache: 30 },
    tiingo: { base: 'https://api.tiingo.com', envKey: 'TIINGO_API_TOKEN', paramName: 'token', cache: 60 },
    fred: { base: 'https://api.stlouisfed.org/fred', envKey: 'FRED_API_KEY', paramName: 'api_key', cache: 300, extraParams: { file_type: 'json' } },
    finnhub: { base: 'https://finnhub.io/api/v1', envKey: 'FINNHUB_API_KEY', paramName: 'token', cache: 5 },
  };

  return {
    name: 'charEdge-api-proxy',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');

      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/proxy\/([^/]+)\/(.*)/);
        if (!match) return next();

        const [, provider, rest] = match;
        const config = PROXY_CONFIGS[provider];
        if (!config) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: `Unknown provider: ${provider}` }));
        }

        // Resolve auth — header-based (Alpaca) vs query-param (others)
        const isHeaderAuth = config.authStyle === 'header';
        const authHeaders = {};

        if (isHeaderAuth && config.envKeys && config.headerMap) {
          for (const [key, envName] of Object.entries(config.envKeys)) {
            const val = env[envName];
            if (!val) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ ok: false, error: `${provider.toUpperCase()} API key not configured` }));
            }
            authHeaders[config.headerMap[key]] = val;
          }
        } else {
          const apiKey = env[config.envKey];
          if (!apiKey) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: `${provider.toUpperCase()} API key not configured` }));
          }
        }

        // Parse path and query
        const [path, qs] = rest.split('?');
        const url = new URL(`${config.base}/${path}`);
        if (qs) {
          for (const param of new URLSearchParams(qs)) {
            url.searchParams.set(param[0], param[1]);
          }
        }
        if (!isHeaderAuth) {
          url.searchParams.set(config.paramName, env[config.envKey]);
        }
        if (config.extraParams) {
          for (const [k, v] of Object.entries(config.extraParams)) {
            url.searchParams.set(k, v);
          }
        }

        try {
          const upstream = await fetch(url.toString(), {
            headers: { 'User-Agent': 'charEdge/1.0', ...authHeaders },
            signal: AbortSignal.timeout(15000),
          });

          res.setHeader('Cache-Control', `public, max-age=${config.cache}`);
          res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
          const body = await upstream.text();
          res.end(body);
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Upstream proxy error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), modulepreloadPlugin(), apiProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-dom/client',
      'react/jsx-runtime', 'react/jsx-dev-runtime',
      'zustand', 'zustand/react', 'zustand/traditional', 'zustand/middleware',
    ],
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/binance-futures': {
        target: 'https://fapi.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/binance-futures/, '')
      },
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
    target: ['es2020', 'safari14', 'chrome87', 'firefox78'],
    outDir: 'dist/client',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    // CDN Strategy (Task 3.2.7): Content-hashed filenames for immutable caching
    rollupOptions: {
      output: {
        // Content-hash all output for cache-busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
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
          if (id.includes('src/pages/ChartsPage') || id.includes('src/pages/MarketsPage')
            || id.includes('src/app/features/chart') || id.includes('src/app/components/chart')) {
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
      include: [
        'src/engine/**',
        'src/utils.js',
        'src/csv.js',
        'src/state/**',
        'src/data/**',
        'src/constants.js',
        'src/api/**',
      ],
      exclude: ['src/__tests__/**'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
    sequence: { shuffle: false },
  },
});
