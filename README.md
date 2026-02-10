# VTT Stream Overlay

Discord reactive image overlay with Foundry VTT integration for immersive D&D actual-play streams.

Each player gets an individual OBS browser source showing their character portrait that:
- **Dims/lights up** and **bounces** when speaking in Discord
- **Swaps to an alternate image set** when their character is bloodied (< 50% HP)

## Architecture

```
┌─────────────────┐     HTTP POST       ┌──────────────────────┐
│  Discord Bot     │ ──────────────────► │                      │
│  (voice state)   │                     │   Next.js Web App    │
└─────────────────┘                     │                      │
                                        │  - Config UI         │
┌─────────────────┐     HTTP POST       │  - State manager     │
│  Foundry VTT     │ ──────────────────► │  - SSE endpoints     │
│  Module (v13)    │                     │  - Browser source    │
└─────────────────┘                     │    pages             │
                                        └──────┬───────────────┘
                                               │ SSE (Server-Sent Events)
                                               ▼
                                        ┌──────────────────────┐
                                        │  Browser Sources      │
                                        │  (one per player,     │
                                        │   loaded in OBS)      │
                                        └──────────────────────┘
```

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Web App | `src/` | Next.js app — config UI, API routes, SSE, browser source pages |
| Discord Bot | `discord-bot/` | Monitors voice channel speaking state |
| Foundry Module | `foundry-module/` | Pushes character HP data from Foundry VTT v13 |

## Quick Start (Local Development)

### 1. Install dependencies

```bash
npm install
cd discord-bot && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `API_SECRET` — Shared secret between all components
- `NEXT_PUBLIC_APP_URL` — Web app URL (default: http://localhost:3000)

### 3. Start the web app

```bash
npm run dev
```

Open http://localhost:3000 to access the config dashboard.

### 4. Configure & start the Discord bot

Open the dashboard and use the **Discord Bot** panel at the top:

1. Click **Configure Bot** and paste your bot token
2. Select your Discord server from the list
3. Pick the voice channel to monitor
4. Click **Save & Connect** — the bot starts automatically

The bot can be started/stopped from the dashboard at any time. You can also view live bot logs from the UI.

**Alternative (env vars):** You can still configure the bot via environment variables for headless/Docker setups. Add these to `.env`:
- `DISCORD_BOT_TOKEN`, `GUILD_ID`, `VOICE_CHANNEL_ID`
- Then run `npm run discord-bot` manually

### 5. Install the Foundry module

Copy the `foundry-module/` directory to your Foundry VTT modules folder:
```
{FoundryData}/Data/modules/gluniverse-reactive-image/
```

Enable the module in Foundry, then configure the Web App URL and API Secret in module settings.

## Discord Bot Setup

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot and copy the token
3. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent (not strictly required but recommended)
4. Invite the bot to your server with these permissions:
   - Connect (to join voice channels)
   - View Channels
5. The bot must be in the voice channel to detect speaking events

## Deploy to Vercel (Web App)

The web app deploys to Vercel. The Discord bot must run separately.

```bash
npx vercel
```

**Important:** Set these environment variables in Vercel dashboard:
- `API_SECRET`
- `NEXT_PUBLIC_APP_URL` (your Vercel deployment URL)

**Note on real-time:** The web app uses Server-Sent Events (SSE) for browser source updates, which works on Vercel's serverless architecture.

## Deploy with Docker

```bash
docker compose up -d
```

This starts both the web app and Discord bot. Set environment variables in `.env`.

## How It Works

### Player Slots

A **player slot** binds together:
- A Discord user (voice state source)
- A Foundry VTT actor (HP source)
- 4 images (healthy-idle, healthy-speaking, bloodied-idle, bloodied-speaking)

Up to 7 slots (5-6 players + 1 DM).

### Image States

| State | Condition |
|-------|-----------|
| Healthy | HP >= 50% of max |
| Bloodied | HP < 50% of max |

Each state has idle (dimmed) and speaking (bright + bounce) variants.

### Browser Source (OBS)

Add as a browser source in OBS:
```
{APP_URL}/overlay/{slotId}?w=300&h=400
```

Custom dimensions via URL params: `?w=WIDTH&h=HEIGHT`

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/slots` | List all slots |
| POST | `/api/slots` | Create a slot |
| GET/PUT/DELETE | `/api/slots/:id` | Manage a slot |
| POST | `/api/slots/:id/images` | Upload images |
| GET | `/api/events/:slotId` | SSE stream for browser source |
| POST | `/api/state` | Receive state from bot/Foundry |
| GET | `/api/discord-users` | List users in voice channel |
| GET | `/api/foundry-actors` | List Foundry actors |
| GET/PUT/DELETE | `/api/discord-bot/config` | Manage Discord bot config |
| POST | `/api/discord-bot/validate-token` | Validate a Discord bot token |
| POST | `/api/discord-bot/guilds` | List guilds for a bot token |
| POST | `/api/discord-bot/channels` | List voice channels for a guild |
| GET | `/api/discord-bot/status` | Bot process running status + logs |
| POST | `/api/discord-bot/start` | Start the bot process |
| POST | `/api/discord-bot/stop` | Stop the bot process |
