#!/usr/bin/env python3
"""
TradeForge Broker Bridge — IBKR TWS → Derived Analytics
=========================================================

Connects to Interactive Brokers TWS API, subscribes to futures
market data, computes derived analytics (VWAP, Delta, ATR, RSI,
signals), and pushes ONLY derived values to TradeForge via WebSocket.

Raw prices are NEVER transmitted — only proprietary computations.

Usage:
    python bridge.py                    # Use config.json
    python bridge.py --config my.json   # Custom config

Requirements:
    pip install ib_insync websockets numpy
"""

import asyncio
import json
import signal
import sys
import time
import logging
from pathlib import Path
from collections import deque
from typing import Optional

try:
    import numpy as np
except ImportError:
    np = None
    print("WARNING: numpy not installed. Using basic math fallbacks.")

try:
    import websockets
except ImportError:
    websockets = None
    print("ERROR: websockets package required. Run: pip install websockets")
    sys.exit(1)

# ─── Configuration ───────────────────────────────────────────────

DEFAULT_CONFIG = {
    "tws": {"host": "127.0.0.1", "port": 7496, "client_id": 1},
    "tradeforge": {"ws_url": "ws://localhost:3000/ws/bridge", "auth_token": ""},
    "instruments": [
        {"symbol": "ES", "sec_type": "FUT", "exchange": "CME", "currency": "USD", "description": "E-mini S&P 500"},
        {"symbol": "NQ", "sec_type": "FUT", "exchange": "CME", "currency": "USD", "description": "E-mini Nasdaq-100"},
        {"symbol": "CL", "sec_type": "FUT", "exchange": "NYMEX", "currency": "USD", "description": "Crude Oil"},
        {"symbol": "GC", "sec_type": "FUT", "exchange": "COMEX", "currency": "USD", "description": "Gold"},
    ],
    "analytics": {
        "vwap_reset_time": "09:30",
        "atr_period": 14,
        "rsi_period": 14,
        "delta_window_minutes": 15,
        "update_interval_seconds": 1,
        "signal_threshold": 0.7,
    },
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")


# ─── Analytics Engine ────────────────────────────────────────────


class DerivedAnalytics:
    """
    Computes derived analytics from raw tick data.
    Only derived values are ever exposed externally.
    """

    def __init__(self, symbol: str, config: dict):
        self.symbol = symbol
        self.config = config

        # Internal tick accumulator (NEVER exported)
        self._ticks = deque(maxlen=10000)
        self._highs = deque(maxlen=200)
        self._lows = deque(maxlen=200)
        self._closes = deque(maxlen=200)
        self._volumes = deque(maxlen=10000)

        # VWAP state
        self._vwap_cum_vol = 0.0
        self._vwap_cum_pv = 0.0
        self._vwap = 0.0

        # Delta state
        self._buy_volume = 0.0
        self._sell_volume = 0.0
        self._delta_window = deque(maxlen=900)  # 15 min at 1 tick/sec

        # ATR state
        self._atr = 0.0
        self._prev_close = 0.0

        # RSI state
        self._gains = deque(maxlen=config.get("rsi_period", 14))
        self._losses = deque(maxlen=config.get("rsi_period", 14))
        self._rsi = 50.0

        # Signal state
        self._signal_score = 0.0
        self._signal_direction = "neutral"

    def ingest_tick(self, price: float, volume: float, side: str):
        """
        Process a raw tick. Internal only — raw data stays here.
        """
        now = time.time()
        self._ticks.append((now, price, volume, side))

        # VWAP accumulation
        self._vwap_cum_vol += volume
        self._vwap_cum_pv += price * volume
        if self._vwap_cum_vol > 0:
            self._vwap = self._vwap_cum_pv / self._vwap_cum_vol

        # Delta tracking
        if side == "buy":
            self._buy_volume += volume
        else:
            self._sell_volume += volume
        self._delta_window.append((now, volume if side == "buy" else -volume))

        # Volume tracking
        self._volumes.append(volume)

    def ingest_bar(self, high: float, low: float, close: float):
        """
        Process a completed bar (for ATR/RSI).
        """
        self._highs.append(high)
        self._lows.append(low)

        # RSI
        if self._closes:
            change = close - self._closes[-1]
            self._gains.append(max(0, change))
            self._losses.append(max(0, -change))

            if len(self._gains) >= 2:
                avg_gain = sum(self._gains) / len(self._gains)
                avg_loss = sum(self._losses) / len(self._losses)
                if avg_loss > 0:
                    rs = avg_gain / avg_loss
                    self._rsi = 100 - (100 / (1 + rs))
                else:
                    self._rsi = 100.0

        # ATR
        if self._prev_close > 0 and len(self._highs) >= 2:
            tr = max(
                high - low,
                abs(high - self._prev_close),
                abs(low - self._prev_close),
            )
            atr_period = self.config.get("atr_period", 14)
            if self._atr > 0:
                self._atr = (self._atr * (atr_period - 1) + tr) / atr_period
            else:
                self._atr = tr

        self._prev_close = close
        self._closes.append(close)

        # Update signal
        self._compute_signal()

    def _compute_signal(self):
        """
        Proprietary signal computation.
        Combines VWAP deviation, RSI, delta, and ATR into a single score.
        """
        if not self._closes or self._vwap == 0:
            return

        last_price = self._closes[-1]
        threshold = self.config.get("signal_threshold", 0.7)

        # Factor 1: VWAP deviation (mean reversion signal)
        vwap_dev = (last_price - self._vwap) / self._vwap if self._vwap else 0
        vwap_signal = max(-1, min(1, -vwap_dev * 50))  # Inverted: above VWAP = bearish

        # Factor 2: RSI extremes
        rsi_signal = 0
        if self._rsi > 70:
            rsi_signal = -(self._rsi - 70) / 30  # Overbought = bearish
        elif self._rsi < 30:
            rsi_signal = (30 - self._rsi) / 30   # Oversold = bullish

        # Factor 3: Delta (buying pressure vs selling)
        total_vol = self._buy_volume + self._sell_volume
        delta_signal = 0
        if total_vol > 0:
            delta_ratio = (self._buy_volume - self._sell_volume) / total_vol
            delta_signal = max(-1, min(1, delta_ratio * 2))

        # Combined signal (weighted average)
        self._signal_score = (vwap_signal * 0.35 + rsi_signal * 0.35 + delta_signal * 0.30)
        self._signal_score = max(-1, min(1, self._signal_score))

        if self._signal_score > threshold:
            self._signal_direction = "bullish"
        elif self._signal_score < -threshold:
            self._signal_direction = "bearish"
        else:
            self._signal_direction = "neutral"

    def get_derived(self) -> dict:
        """
        Return ONLY derived analytics — no raw prices.
        This is what gets transmitted to TradeForge.
        """
        now = time.time()

        # Calculate windowed delta
        window_secs = self.config.get("delta_window_minutes", 15) * 60
        windowed_delta = sum(
            vol for ts, vol in self._delta_window if now - ts < window_secs
        )

        # VWAP deviation as ATR multiple
        vwap_dev_atr = 0
        if self._atr > 0 and self._vwap > 0 and self._closes:
            vwap_dev_atr = round((self._closes[-1] - self._vwap) / self._atr, 2)

        return {
            "symbol": self.symbol,
            "type": "derived_analytics",
            "timestamp": int(now * 1000),

            # VWAP analytics (no raw price)
            "vwap_deviation_pct": round(
                ((self._closes[-1] - self._vwap) / self._vwap * 100) if self._vwap and self._closes else 0, 3
            ),
            "vwap_deviation_atr": vwap_dev_atr,
            "above_vwap": bool(self._closes and self._closes[-1] > self._vwap),

            # Delta analytics
            "cumulative_delta": round(self._buy_volume - self._sell_volume, 2),
            "windowed_delta": round(windowed_delta, 2),
            "delta_direction": "positive" if windowed_delta > 0 else "negative",

            # Volatility analytics
            "atr_value": round(self._atr, 4),
            "atr_band_upper": round(vwap_dev_atr + 2, 2) if vwap_dev_atr else 0,
            "atr_band_lower": round(vwap_dev_atr - 2, 2) if vwap_dev_atr else 0,

            # Momentum analytics
            "rsi": round(self._rsi, 1),
            "rsi_zone": "overbought" if self._rsi > 70 else "oversold" if self._rsi < 30 else "neutral",

            # Proprietary signal
            "signal_score": round(self._signal_score, 3),
            "signal_direction": self._signal_direction,
            "signal_confidence": round(abs(self._signal_score), 3),

            # Volume analytics
            "volume_ratio": round(
                self._buy_volume / self._sell_volume if self._sell_volume > 0 else 0, 2
            ),
            "total_ticks": len(self._ticks),
        }

    def reset_session(self):
        """Reset VWAP and delta for new trading session."""
        self._vwap_cum_vol = 0.0
        self._vwap_cum_pv = 0.0
        self._buy_volume = 0.0
        self._sell_volume = 0.0
        self._delta_window.clear()
        log.info(f"[{self.symbol}] Session reset — VWAP and delta cleared")


# ─── Bridge Core ─────────────────────────────────────────────────


class BrokerBridge:
    """
    Main bridge: connects to TWS, computes analytics, pushes to TradeForge.
    """

    def __init__(self, config: dict):
        self.config = config
        self.analytics: dict[str, DerivedAnalytics] = {}
        self._running = False
        self._ws = None
        self._ib = None

        # Initialize analytics engines
        for inst in config.get("instruments", []):
            sym = inst["symbol"]
            self.analytics[sym] = DerivedAnalytics(sym, config.get("analytics", {}))

    async def start(self):
        """Start the bridge: connect to TWS and TradeForge."""
        self._running = True
        log.info("=" * 60)
        log.info("TradeForge Broker Bridge starting...")
        log.info(f"Instruments: {list(self.analytics.keys())}")
        log.info("=" * 60)

        # Connect to TradeForge WebSocket
        tf_url = self.config["tradeforge"]["ws_url"]
        try:
            self._ws = await websockets.connect(tf_url)
            log.info(f"Connected to TradeForge at {tf_url}")
        except Exception as e:
            log.warning(f"TradeForge WS not available ({e}). Running in offline mode.")
            self._ws = None

        # Connect to TWS (ib_insync)
        try:
            from ib_insync import IB, Contract
            self._ib = IB()
            tws = self.config["tws"]
            await self._ib.connectAsync(tws["host"], tws["port"], clientId=tws["client_id"])
            log.info(f"Connected to TWS at {tws['host']}:{tws['port']}")

            # Subscribe to market data for each instrument
            for inst in self.config.get("instruments", []):
                contract = Contract(
                    symbol=inst["symbol"],
                    secType=inst["sec_type"],
                    exchange=inst["exchange"],
                    currency=inst["currency"],
                )
                # Request real-time bars (5-second bars)
                self._ib.reqRealTimeBars(contract, 5, "TRADES", False)
                log.info(f"Subscribed to {inst['symbol']} on {inst['exchange']}")

            # Set up bar handler
            self._ib.barUpdateEvent += self._on_bar_update

        except ImportError:
            log.warning("ib_insync not installed. Running in DEMO mode with simulated data.")
            asyncio.create_task(self._simulate_data())
        except Exception as e:
            log.warning(f"TWS connection failed: {e}. Running in DEMO mode.")
            asyncio.create_task(self._simulate_data())

        # Start the analytics push loop
        await self._push_loop()

    async def _push_loop(self):
        """Push derived analytics to TradeForge at configured interval."""
        interval = self.config.get("analytics", {}).get("update_interval_seconds", 1)

        while self._running:
            for sym, engine in self.analytics.items():
                derived = engine.get_derived()

                # Push to TradeForge WS if connected
                if self._ws:
                    try:
                        await self._ws.send(json.dumps(derived))
                    except Exception:
                        log.warning("TradeForge WS disconnected. Attempting reconnect...")
                        self._ws = None
                        try:
                            self._ws = await websockets.connect(
                                self.config["tradeforge"]["ws_url"]
                            )
                            log.info("Reconnected to TradeForge WS")
                        except Exception:
                            pass

                # Log summary
                log.debug(
                    f"[{sym}] VWAP dev: {derived['vwap_deviation_pct']:+.3f}% | "
                    f"Delta: {derived['cumulative_delta']:+.0f} | "
                    f"RSI: {derived['rsi']:.1f} | "
                    f"Signal: {derived['signal_direction']} ({derived['signal_score']:+.3f})"
                )

            await asyncio.sleep(interval)

    def _on_bar_update(self, bars, has_new_bar):
        """Handle 5-second real-time bar updates from TWS."""
        if not has_new_bar or not bars:
            return

        bar = bars[-1]
        # Find which instrument this belongs to
        symbol = bars.contract.symbol if hasattr(bars, "contract") else "UNKNOWN"

        engine = self.analytics.get(symbol)
        if not engine:
            return

        # Ingest bar data
        engine.ingest_bar(bar.high, bar.low, bar.close)

        # Simulate tick-level delta from bar data
        avg_price = (bar.high + bar.low + bar.close) / 3
        if bar.close >= bar.open:
            engine.ingest_tick(avg_price, bar.volume * 0.6, "buy")
            engine.ingest_tick(avg_price, bar.volume * 0.4, "sell")
        else:
            engine.ingest_tick(avg_price, bar.volume * 0.4, "buy")
            engine.ingest_tick(avg_price, bar.volume * 0.6, "sell")

    async def _simulate_data(self):
        """Generate simulated data for demo/testing without TWS."""
        import random

        log.info("Starting DEMO mode with simulated futures data...")

        # Starting prices for each instrument
        prices = {"ES": 5250.0, "NQ": 18500.0, "CL": 72.50, "GC": 2050.0}

        while self._running:
            for sym, engine in self.analytics.items():
                base = prices.get(sym, 1000.0)
                # Random walk
                change = random.gauss(0, base * 0.0002)
                base += change
                prices[sym] = base

                high = base + abs(random.gauss(0, base * 0.0003))
                low = base - abs(random.gauss(0, base * 0.0003))

                # Ingest simulated bar
                engine.ingest_bar(high, low, base)

                # Ingest simulated ticks
                vol = random.uniform(50, 500)
                side = "buy" if random.random() > 0.48 else "sell"
                engine.ingest_tick(base, vol, side)

            await asyncio.sleep(1)

    async def stop(self):
        """Graceful shutdown."""
        self._running = False
        if self._ws:
            await self._ws.close()
        if self._ib:
            self._ib.disconnect()
        log.info("Bridge stopped.")


# ─── Main ────────────────────────────────────────────────────────


def load_config(path: str = "config.json") -> dict:
    """Load config from file, falling back to defaults."""
    config_path = Path(path)
    if config_path.exists():
        with open(config_path) as f:
            user_config = json.load(f)
            # Merge with defaults
            config = {**DEFAULT_CONFIG}
            for key in user_config:
                if isinstance(user_config[key], dict) and key in config:
                    config[key] = {**config[key], **user_config[key]}
                else:
                    config[key] = user_config[key]
            return config
    else:
        log.warning(f"Config file '{path}' not found. Using defaults.")
        return DEFAULT_CONFIG


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="TradeForge Broker Bridge")
    parser.add_argument("--config", default="config.json", help="Config file path")
    args = parser.parse_args()

    config = load_config(args.config)
    bridge = BrokerBridge(config)

    # Handle graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: asyncio.create_task(bridge.stop()))
        except NotImplementedError:
            pass  # Windows

    try:
        await bridge.start()
    except KeyboardInterrupt:
        await bridge.stop()


if __name__ == "__main__":
    asyncio.run(main())
