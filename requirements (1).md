# VTT Stream Overlay — Requirements Document

**Project:** Discord Reactive Image Overlay with Foundry VTT Integration
**Purpose:** Real-time character portrait overlays for an immersive D&D actual-play stream
**Stack:** Node.js / TypeScript
**Foundry VTT Version:** v13

---

## 1. Overview

A system that displays character portraits in OBS that react to Discord voice activity and Foundry VTT character state. Each player gets an individual browser source showing their character portrait that dims/lights up and bounces when speaking, and swaps to an alternate image set when their character is bloodied.

### Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────────┐
│  Discord Bot     │ ──────────────────► │                      │
│  (voice state)   │                     │   Web App (Server)   │
└─────────────────┘                     │                      │
                                        │  - Config UI         │
┌─────────────────┐     WebSocket/HTTP  │  - State manager     │
│  Foundry VTT     │ ──────────────────► │  - Browser source    │
│  Module (v13)    │                     │    endpoints         │
└─────────────────┘                     └──────┬───────────────┘
                                               │ WebSocket
                                               ▼
                                        ┌──────────────────────┐
                                        │  Browser Sources      │
                                        │  (one per player,     │
                                        │   loaded in OBS)      │
                                        └──────────────────────┘
```

### Deliverables

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | **Web App** | Central server, config UI, serves browser source pages |
| 2 | **Discord Bot** | Monitors speaking state via Discord Gateway API |
| 3 | **Foundry VTT v13 Module** | Pushes character HP data to the web app |

---

## 2. Core Concepts

### Player Slot

A **player slot** binds together:

- A **Discord user** (voice state source)
- A **Foundry VTT actor** (HP source)
- An **image set** (portraits for each state)

Up to **7 slots** (5–6 players + 1 DM/GM).

### Image States

Each slot has **two states** driven by HP:

| State | Condition | Description |
|-------|-----------|-------------|
| **Healthy** | HP ≥ 50% of max | Default portrait set |
| **Bloodied** | HP < 50% of max | Injured/alternate portrait set |

Each state has **two images**:

| Sub-state | Trigger |
|-----------|---------|
| **Idle** | Not speaking in Discord |
| **Speaking** | Currently speaking in Discord |

So each slot requires **4 images total**: healthy-idle, healthy-speaking, bloodied-idle, bloodied-speaking.

### Visual Behavior

| Condition | Visual Treatment |
|-----------|-----------------|
| Idle | Image is **dimmed** (opacity/brightness reduction) |
| Speaking | Image is **full brightness** + **subtle bounce animation** |
| State transition (healthy ↔ bloodied) | Smooth crossfade between image sets |

---

## 3. Web App

### 3.1 Server

- **Runtime:** Node.js with TypeScript
- **Transport:** WebSocket (for real-time state from bot + module, and push to browser sources)
- **HTTP:** Serves config UI and browser source pages
- **State:** In-memory state store for current voice + HP state per slot (no database required for v1)
- **Config persistence:** JSON file on disk

### 3.2 Config UI

A web-based dashboard for the streamer to:

- **Manage player slots** — create, edit, delete (up to 7)
- **Assign Discord user** — select from users currently in voice channel (fetched from bot)
- **Assign Foundry actor** — select from actors pushed by the Foundry module
- **Upload images** — 4 images per slot (healthy-idle, healthy-speaking, bloodied-idle, bloodied-speaking)
- **Preview** — live preview of each slot's current state
- **Copy browser source URL** — one-click copy of the individual browser source URL for each slot

### 3.3 Browser Source Endpoints

- **Route:** `GET /overlay/:slotId`
- **Output:** Self-contained HTML page (transparent background) showing the single player's reactive portrait
- **Connection:** Connects to server via WebSocket to receive real-time state updates
- **Rendering:** CSS transitions for dim/brighten, CSS animation for bounce, crossfade for image swap
- **OBS-compatible:** Transparent background, no scrollbars, fixed dimensions (configurable per slot or global default)

### 3.4 API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/slots` | List all configured slots |
| `POST` | `/api/slots` | Create/update a slot |
| `DELETE` | `/api/slots/:id` | Delete a slot |
| `POST` | `/api/slots/:id/images` | Upload images for a slot |
| `GET` | `/overlay/:slotId` | Browser source page |
| `WS` | `/ws/overlay/:slotId` | WebSocket for browser source state updates |
| `WS` | `/ws/discord` | WebSocket for Discord bot to push voice state |
| `WS` | `/ws/foundry` | WebSocket for Foundry module to push HP data |

---

## 4. Discord Bot

### Purpose

Monitor voice channel speaking state and push it to the web app in real-time.

### Requirements

- Connect to Discord Gateway with **Voice State** and **Guild Members** intents
- Detect when users **start/stop speaking** in a monitored voice channel
- Push speaking state changes to the web app via WebSocket: `{ userId, speaking: boolean }`
- Provide a list of users in the current voice channel (for config UI user assignment)
- **Single guild, single voice channel** scope (configurable)

### Auth

- Discord bot token (configured via env var)
- Bot must be in the voice channel to receive speaking events

### Notes

- Discord's speaking detection is via the `SPEAKING` event on the voice WebSocket — the bot must join the voice channel as a listener (does not need to transmit audio)
- Latency target: < 200ms from voice event to browser source update

---

## 5. Foundry VTT v13 Module

### Purpose

Push character HP data from Foundry VTT to the web app so image states can react to character condition.

### Requirements

- **Foundry v13 compatible** module
- On actor HP change, push update to web app: `{ actorId, actorName, hp: number, maxHp: number }`
- On module activation, push full roster of actors (id, name, current HP, max HP) for config UI
- **Connection:** WebSocket or HTTP POST to configurable web app URL
- **Config in Foundry:** Module settings for web app server URL and optional API key/shared secret

### Data Flow

1. Hook into `updateActor` and/or `preUpdateActor` hooks in Foundry v13
2. Filter for HP-relevant changes (`system.attributes.hp.value`, `system.attributes.hp.max` — path depends on game system, default to D&D 5e / dnd5e)
3. Push to web app immediately on change

### Game System Assumption

- Default: **dnd5e** system for Foundry
- HP path: `actor.system.attributes.hp.value` / `actor.system.attributes.hp.max`
- Should be configurable in module settings for other systems

---

## 6. Browser Source (OBS) Behavior Spec

### Layout

- Single character portrait, centered
- Transparent background (OBS chroma not needed)
- Default size: 300×400px (configurable via URL params: `?w=300&h=400`)

### Animations

| Trigger | Animation |
|---------|-----------|
| Start speaking | Fade to full brightness (~150ms), begin bounce loop |
| Stop speaking | Fade to dimmed (~300ms), stop bounce |
| Bounce | Subtle vertical translate (e.g., `translateY(-4px)` oscillating, ~0.6s period) |
| HP state change | Crossfade between image sets (~500ms) |

### Reconnection

- Auto-reconnect WebSocket on disconnect (exponential backoff, max 5s)
- Show last known state during disconnection (don't flash or blank out)

---

## 7. Security (v1 — Minimal)

- Shared secret / API key between all three components (env var)
- No public auth on browser source URLs (assumed local network or known URLs)
- Config UI: optional basic password protection

---

## 8. Configuration

All config via a combination of:

- **Environment variables:** Discord bot token, server port, shared secret
- **Config file (JSON):** Slot definitions, image paths, Foundry server URL
- **Config UI:** Runtime management of slots and images

---

## 9. Deployment

Deployment model TBD. Architecture should support both:

- **Local:** Run on streamer's machine or LAN during sessions
- **Cloud:** Deployable to a VPS (single Docker container or simple `node` process)

Provide a `Dockerfile` and `docker-compose.yml` for easy deployment either way.

---

## 10. Non-Goals (v1)

These are explicitly out of scope for v1 but the architecture should not preclude them:

- Multiple voice channels simultaneously
- Animated image support (GIFs, sprite sheets)
- Additional Foundry conditions beyond HP (poisoned, death saves, initiative)
- Custom animation per slot
- Audio-reactive effects (mouth sync, waveform)
- Multi-guild Discord support
- Composite overlay (all players in one source)
- User-facing auth / multi-streamer support

---

## 11. Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Web App Server | Node.js + TypeScript, Express (or Fastify), ws library |
| Config UI | Served by same server — React or plain HTML/JS (lightweight) |
| Browser Sources | Static HTML + CSS + vanilla JS (WebSocket client) |
| Discord Bot | discord.js v14+ (runs in same Node process or separate) |
| Foundry Module | Foundry VTT v13 module (JS, Foundry module API) |
| Persistence | JSON file (v1), optional SQLite later |
| Deployment | Docker / docker-compose |

---

## 12. Milestone Plan

| Phase | Scope | Outcome |
|-------|-------|---------|
| **M1** | Discord bot + web app + browser source (no Foundry) | Reactive images working in OBS from Discord voice |
| **M2** | Config UI | Streamer can manage slots, upload images, copy URLs |
| **M3** | Foundry VTT module + HP integration | Image sets swap based on character HP |
| **M4** | Polish | Reconnection handling, error states, deploy packaging |
