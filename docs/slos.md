# Service Level Objectives (SLOs)

## Data Freshness
| Metric | Target | Measurement |
|--------|--------|-------------|
| WebSocket tick latency (client → display) | < 2s | P99 delivery time from exchange WS to rendered tick |
| Historical data load | < 3s for 500 candles | API response time for GET /api/v1/trades |
| **SLO**: 99.5% of ticks delivered within 2s | Error budget: 3.6 hours/month ||

## API Performance
| Metric | Target | Measurement |
|--------|--------|-------------|
| P50 latency | < 50ms | Server-side request duration |
| P95 latency | < 200ms | Server-side request duration |
| P99 latency | < 500ms | Server-side request duration |
| **SLO**: 99.9% of requests complete within 200ms | Error budget: 43 min/month ||

## Availability
| Metric | Target | Measurement |
|--------|--------|-------------|
| HTTP 5xx rate | < 0.1% | Errors / total requests |
| Health check success | > 99.9% | `/health/deep` probe every 30s |
| **SLO**: 99.9% uptime | Error budget: 43 min/month ||

## Client Performance
| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse / Web Vitals |
| Chart render frame budget | < 16ms (60fps) | `performance.now()` in render loop |
| Bundle size (gzipped) | < 250KB main chunk | CI build step |

## Monitoring
- **Health endpoint**: `/health/deep` — DB write/read verification
- **Sentry**: Error tracking with 0.2 trace sample rate
- **CI**: All SLO-relevant benchmarks run on every PR
