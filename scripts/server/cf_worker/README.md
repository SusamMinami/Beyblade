# Beyblade Battle Server (Cloudflare Worker)

A zero-cost frame-sync relay and async replay server running on Cloudflare Free Tier.

## Features

- **Frame Sync Relay**: Durable Object based WebSocket relay for synchronous PVP
- **Matchmaker**: Simple queue-based matchmaking with rank/rating buckets
- **Async Replay Submission**: R2 storage for replay verification
- **Cross-platform**: Same protocol works with Godot and Web (Three.js) clients

## Quick Start

```bash
cd scripts/server/cf_worker
npm install
npm run dev
```

Deploy to Cloudflare:

```bash
npm run deploy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/create-room` | Create a private room, returns `room_id` and `ws_url` |
| POST | `/api/match/enqueue` | Join public matchmaking queue |
| POST | `/api/match/cancel` | Leave queue |
| GET | `/api/room/:id/ws` | WebSocket endpoint for frame sync |
| POST | `/api/submit-replay` | Submit async replay for verification |
| GET | `/room/:id/status` | Get room status |

## WebSocket Protocol

Messages use JSON envelopes:

```json
{ "type": "launch", "data": { ... }, "seq": 1 }
```

See `src/protocol.ts` for full message types and the main architecture doc for protocol details.

## Free Tier Limits (Cloudflare Free)

- Workers: 100,000 requests/day
- Durable Objects: No explicit request cap; CPU per request limited
- R2: 10 GB storage, 1,000,000 Class A ops/month
- WebSocket: Supported through Durable Objects, no extra cost for basic relay

## Deployment Notes

- **China Access**: Free tier uses global Cloudflare network. For mainland China users, consider Hong Kong/Asia routes or a domestic server for low-latency synchronous play. Async verification works fine at higher latency.
- **Anti-cheat**: Frame sync relay mode does not run server-side physics (to stay within free tier). Use hash verification, replay auditing, and gradual rollout to State Sync (with Godot headless) for ranked play.
