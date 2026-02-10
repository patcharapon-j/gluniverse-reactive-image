# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Web App (Next.js)
npm install          # install dependencies
npm run dev          # start dev server on :3000
npm run build        # production build
npm run lint         # ESLint

# Discord Bot (separate process, separate dependencies)
cd discord-bot && npm install
npm run discord-bot           # run from project root
cd discord-bot && npm run dev # run with file watching

# Foundry Module — no build step; copy foundry-module/ to Foundry's modules dir
```

No test framework is configured yet.

## Architecture

Three independent components communicate via HTTP:

```
Discord Bot ──POST /api/state──► Next.js Web App ◄──POST /api/state── Foundry VTT Module
                                       │
                                  SSE /api/events/:slotId
                                       │
                                       ▼
                                 OBS Browser Sources
```

### Web App (`src/`) — Next.js 15 App Router, Tailwind v4

- **`src/lib/types.ts`** — All shared TypeScript types. The central `PlayerSlot` binds a Discord user + Foundry actor + 4 images. `OverlayState` is what browser sources receive.
- **`src/lib/state.ts`** — Singleton `StateManager` class. In-memory pub/sub that maps Discord user IDs and Foundry actor IDs to player slots, resolves which image to show based on speaking + HP state, and notifies SSE listeners. This is the runtime heart of the app.
- **`src/lib/config.ts`** — Reads/writes `config.json` at project root. Caches in memory. Every mutation also calls `stateManager.registerSlot()` to keep runtime state in sync.
- **`src/app/api/state/route.ts`** — Single ingestion endpoint for both Discord bot and Foundry module. Accepts `type` field: `"voice"`, `"hp"`, `"voice-users"`, `"roster"`/`"foundry-actors"`. Validates `x-api-secret` header against `API_SECRET` env var.
- **`src/app/api/events/[slotId]/route.ts`** — SSE streaming endpoint. Uses `ReadableStream` + `stateManager.subscribe()` to push `OverlayState` JSON to browser sources. 15s keepalive.
- **`src/app/overlay/`** — Has its own `layout.tsx` (bare HTML, transparent background, no Tailwind) so browser sources don't inherit dashboard styling. The `[slotId]/page.tsx` is self-contained with inline `<style>` for animations.
- **`src/app/page.tsx`** + **`src/components/`** — Config dashboard. Client components using `'use client'`. Tailwind dark theme.

### Discord Bot (`discord-bot/`) — Separate Node.js process

- discord.js v14 + @discordjs/voice. Joins voice channel, detects speaking via receiver events.
- Pushes `"voice"` and `"voice-users"` types to `/api/state` via HTTP POST.
- Has its own `package.json` (ESM, `"type": "module"`) and `tsconfig.json`. **Not** part of the Next.js build.
- Env vars: `DISCORD_BOT_TOKEN`, `GUILD_ID`, `VOICE_CHANNEL_ID`, `WEBAPP_URL`, `API_SECRET`.

### Foundry VTT v13 Module (`foundry-module/`) — Runs inside Foundry

- Plain ES module (`main.mjs`). No build step, no npm. Uses Foundry's `Hooks` and `game.settings` APIs.
- Pushes `"hp"` and `"roster"` types to `/api/state`. Configurable HP attribute paths (default: dnd5e `system.attributes.hp`).

## Key Design Decisions

- **SSE instead of WebSocket** for browser source real-time updates — required for Vercel serverless compatibility. The Discord bot and Foundry module push state inbound via plain HTTP POST.
- **In-memory state only** — the `StateManager` singleton holds all runtime voice/HP state. Config (slot definitions) is persisted to `config.json`. If the server restarts, runtime state resets (Discord bot and Foundry module re-push on reconnect).
- **`config.json` at project root** — created automatically on first slot creation. Excluded from Vercel's ephemeral filesystem concerns because slot config is also re-synced from the UI.
- **Max 7 player slots** — enforced in `config.ts:createSlot()`.
- **Bloodied threshold** — HP < 50% of max, computed by `getHpState()` in `types.ts`.
- **Image uploads** — stored in `public/uploads/` as `{slotId}-{imageKey}.{ext}`. On Vercel, this is ephemeral; production would need Vercel Blob or similar.

## Deployment

- **Vercel**: `vercel.json` configures SSE headers and 60s function timeout for the events endpoint. `output: "standalone"` in `next.config.ts` is for Docker but doesn't affect Vercel.
- **Docker**: `Dockerfile` (webapp) + `discord-bot/Dockerfile` + `docker-compose.yml` runs both services.
- The Discord bot **cannot** run on Vercel — it requires a persistent process for the Discord Gateway connection.
