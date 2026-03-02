# TradeForge Broker Bridge

A local bridge script that connects to your **IBKR TWS API**, computes derived analytics (VWAP, Delta, ATR, RSI), and pushes them to TradeForge via WebSocket.

> **IMPORTANT:** This bridge runs on YOUR machine with YOUR funded IBKR account. Raw prices never cross a public boundary — only derived analytics are transmitted.

## Prerequisites

1. **IBKR Lite account** ($500 minimum deposit)
2. **CME Level 1 data subscription** (~$15/mo for non-pro)
3. **TWS or IB Gateway** running locally
4. **Python 3.10+** with dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Quick Start

```bash
# 1. Copy config template
cp config.example.json config.json

# 2. Edit config.json with your TWS host/port
notepad config.json

# 3. Start TWS or IB Gateway (enable API connections on port 7496)

# 4. Run the bridge
python bridge.py
```

## How It Works

```
TWS API ──► Bridge Script ──► Compute VWAP, Delta, ATR, RSI
                                    │
                                    ▼
                           TradeForge WebSocket
                           (derived analytics only)
```

### What Gets Transmitted (Legal)

- ✅ Session VWAP deviation percentage
- ✅ Cumulative delta (buy vs sell pressure)
- ✅ ATR bands and volatility metrics
- ✅ RSI and momentum signals
- ✅ Support/resistance zones
- ✅ Proprietary signal scores

### What Does NOT Get Transmitted

- ❌ Raw prices (last trade, bid, ask)
- ❌ Raw volume data
- ❌ Level 2 / order book depth
- ❌ Any CME market data tape

## Supported Instruments

| Symbol | Description |
|--------|-------------|
| ES     | E-mini S&P 500 |
| NQ     | E-mini Nasdaq-100 |
| CL     | Crude Oil |
| GC     | Gold |
| YM     | E-mini Dow |
| RTY    | E-mini Russell 2000 |

## Configuration

See `config.example.json` for all available options.
