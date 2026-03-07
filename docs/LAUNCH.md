# charEdge — Launch Playbook

> **Target: April 15, 2026 — Beta Launch**

---

## 🎯 Product Hunt Launch (Primary Channel)

### Listing Copy

**Name:** charEdge
**Tagline:** "Institutional-grade charting meets behavioral AI — 100K candles in 5ms"

**First Comment (Maker):**

> Hey PH! 👋 I'm [name], maker of charEdge.
>
> I built this because every charting platform treats traders like order-entry robots. None of them answer the real question: *"Why do I keep making the same mistakes?"*
>
> charEdge combines a WebGPU-accelerated chart engine (renders 100K candles in <5ms) with an AI behavioral coach that learns your patterns. It connects your journal to your charts, detects tilting, and gives you a morning briefing from your actual trading data.
>
> **Key differentiators:**
> - 🚀 WebGPU engine — 3-10x faster than TradingView/TrendSpider
> - 🧠 AI Coach — not just price signals, but psychological insights
> - 📓 Journal ↔ Chart Link — ghost boxes overlay your trades on the chart
> - 🎯 Zero Idle Burn — 0% CPU when you're not interacting
> - 🆓 Open source (MIT) — self-host or use our hosted version
>
> Would love your feedback. What features would make you switch from your current charting tool?

### Screenshot Checklist

| # | Screenshot | What to Show |
|---|-----------|-------------|
| 1 | Dashboard hero | Full dashboard with populated data, streak tracker, equity curve |
| 2 | Chart engine | Multi-indicator chart with drawing tools, showing WebGPU rendering |
| 3 | AI Coach | Co-pilot panel with behavioral insights and tilt detection |
| 4 | Journal | Trade journal with ghost box overlay on chart |
| 5 | Mobile | Responsive mobile layout with touch gestures |

### Video Demo Script (30 seconds)

1. **0-5s:** Dashboard → show populated metrics loading instantly
2. **5-12s:** Chart → pan through 100K candles smoothly, zoom in/out
3. **12-18s:** Draw Fibonacci → demonstrate magnet snap and drawing tools
4. **18-25s:** AI Coach → show morning briefing with behavioral insight
5. **25-30s:** Logo + tagline fade in

---

## 💬 Discord Community Setup

### Server Structure

| Channel | Purpose |
|---------|---------|
| `#announcements` | Releases, milestones, launches |
| `#general` | Community discussion |
| `#show-your-setup` | Screenshots of trader setups using charEdge |
| `#bug-reports` | Bug triage (template: OS, browser, steps, screenshot) |
| `#feature-requests` | User-submitted feature ideas (voting with reactions) |
| `#trading-ideas` | Chart annotations and trade analysis sharing |
| `#development` | Technical discussion, contributor chat |

### Bot Setup
- **MEE6** — Welcome message, role assignment, moderation
- **GitHub Webhook** — CI status + release notifications to `#development`
- **Invite Link** — Add to README, landing page footer, Product Hunt listing

---

## 📱 Reddit Launch

### Target Subreddits

| Subreddit | Audience | Angle |
|-----------|----------|-------|
| `r/algotrading` (500K+) | Quant traders | WebGPU performance, open-source charting API |
| `r/daytrading` (1.5M+) | Active traders | Journal ↔ chart link, behavioral insights |
| `r/webdev` (2M+) | Developers | WebGPU rendering tech, React architecture |
| `r/sideproject` (300K+) | Makers | The building journey, tech stack decisions |

### Post Templates

**r/algotrading:**
> **I built an open-source charting engine that renders 100K candles in <5ms using WebGPU**
>
> After 6 months of building, I'm sharing charEdge — a WebGPU/Canvas hybrid charting engine with behavioral AI. Key stats:
> - 100K candles render in <5ms (vs. 50-200ms for TradingView's Canvas implementation)
> - 0% idle rAF burn (battery-friendly)
> - Built-in journal ↔ chart linking (ghost boxes overlay trades)
> - MIT licensed, self-hostable
>
> GitHub: [link] | Live Demo: [link]
>
> Looking for feedback from algo traders — what data integrations would make this useful for you?

### Engagement Strategy
- ✅ Be genuinely helpful in comments
- ✅ Acknowledge limitations honestly
- ✅ Link to GitHub, not just hosted version
- ❌ Don't spam — one post per subreddit, spread over 2 weeks
- ❌ Don't claim to "beat" TradingView — frame as a focused alternative

---

## 🐦 Twitter/X WebGPU Speed Content

### Thread Template: "100K Candles in 5ms"

```
🧵 Thread: How we built a charting engine that renders 100K candles in <5ms

1/ Most charting platforms use Canvas 2D — a single-threaded pixel pusher.
We use WebGPU + OffscreenCanvas workers. Here's the technical breakdown:

2/ The secret: GPU-instanced rendering. Instead of drawing 100K rectangles,
we draw ONE rectangle 100K times with per-instance data uploaded as a buffer.

3/ Our render pipeline:
  WebSocket → TickerPlant → SharedWorker → GPU Buffer → Screen

  Zero main-thread data processing. The UI thread only handles user input.

4/ Benchmark results (M1 MacBook, Chrome 130):
  📊 100K bars: 4.8ms render
  📊 10K bars: 0.6ms render
  📊 Idle CPU: 0.0% (zero rAF burn)
  📊 ProMotion: 120fps on supported displays

5/ The AI layer adds behavioral intelligence:
  🧠 Tilt detection (trading while emotional)
  📓 Journal ↔ chart ghost boxes
  📈 Equity curve with Gaussian smoothing
  🎯 Kelly criterion position sizing

6/ It's open source (MIT).
GitHub: [link]
Demo: [link]

If you're building with WebGPU, happy to share what we learned.
DMs open 🤝
```

### Hashtag Strategy
Primary: `#WebGPU` `#fintech` `#opensource`
Secondary: `#react` `#webdev` `#trading` `#gpucomputing`
Avoid: `#cryptotrading` (attracts bots)

### Content Calendar (Week 2: Mar 14–20)

| Day | Content |
|-----|---------|
| Mon | Screenshot: Dashboard with populated data |
| Tue | Speed benchmark GIF (100K candle pan) |
| Wed | Thread: "100K Candles in 5ms" technical breakdown |
| Thu | Screenshot: AI Coach behavioral insight |
| Fri | "We're launching on Product Hunt next week" teaser |

---

## ✅ Pre-Launch Checklist

- [ ] All P0 tasks complete
- [ ] README has hero section, quick start, feature list
- [ ] Discord server created and linked from README
- [ ] Product Hunt page drafted
- [ ] 5 screenshots captured (see checklist above)
- [ ] 30-second demo GIF/video recorded
- [ ] Reddit posts drafted (1 per subreddit)
- [ ] Twitter thread drafted
- [ ] Landing page live benchmarks working
- [ ] `.env.example` has all required keys documented
