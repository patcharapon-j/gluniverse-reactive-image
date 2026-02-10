import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  VoiceState,
  GuildMember,
} from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  VoiceConnection,
} from "@discordjs/voice";

import { readConfigFromFile } from "./config.js";

// ---------------------------------------------------------------------------
// Environment — config.json values override env vars for Discord settings
// ---------------------------------------------------------------------------

const fileConfig = readConfigFromFile();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function resolveConfig(envName: string, fileValue: string | undefined): string {
  if (fileValue) {
    console.log(`[config] ${envName} loaded from config.json`);
    return fileValue;
  }
  const envValue = process.env[envName];
  if (envValue) {
    console.log(`[config] ${envName} loaded from environment`);
    return envValue;
  }
  console.error(`[config] Missing ${envName} — not found in config.json or environment`);
  process.exit(1);
}

const DISCORD_BOT_TOKEN = resolveConfig("DISCORD_BOT_TOKEN", fileConfig?.botToken);
const GUILD_ID = resolveConfig("GUILD_ID", fileConfig?.guildId);
const VOICE_CHANNEL_ID = resolveConfig("VOICE_CHANNEL_ID", fileConfig?.voiceChannelId);
const WEBAPP_URL = process.env.WEBAPP_URL || "http://localhost:3000";
const API_SECRET = process.env.API_SECRET || "";
console.log(`[config] WEBAPP_URL = ${WEBAPP_URL}${process.env.WEBAPP_URL ? " (from environment)" : " (default)"}`);
if (!API_SECRET) console.log("[config] API_SECRET not set — requests will be unauthenticated");

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/** Track which users we consider "speaking" so we can debounce stop events. */
const speakingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** How long (ms) after the last speaking packet before we consider the user silent. */
const SPEAKING_TIMEOUT_MS = 100;

// ---------------------------------------------------------------------------
// HTTP helper – push state to web app
// ---------------------------------------------------------------------------

async function postState(
  type: "voice",
  data: { userId: string; speaking: boolean }
): Promise<void>;
async function postState(
  type: "voice-users",
  data: Array<{ id: string; username: string; displayName: string }>
): Promise<void>;
async function postState(type: string, data: unknown): Promise<void> {
  const url = `${WEBAPP_URL}/api/state`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": API_SECRET,
      },
      body: JSON.stringify({ type, data }),
    });
    if (!res.ok) {
      console.warn(`[postState] ${type} -> ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.warn(`[postState] ${type} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Voice roster helper
// ---------------------------------------------------------------------------

function getVoiceChannelUsers(client: Client): Array<{ id: string; username: string; displayName: string }> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return [];
  const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel || !channel.isVoiceBased()) return [];
  return channel.members
    .filter((m: GuildMember) => !m.user.bot)
    .map((m: GuildMember) => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
    }));
}

async function pushVoiceUsers(client: Client): Promise<void> {
  const users = getVoiceChannelUsers(client);
  await postState("voice-users", users);
}

// ---------------------------------------------------------------------------
// Voice connection + speaking detection
// ---------------------------------------------------------------------------

let connection: VoiceConnection | null = null;

function connectToVoice(client: Client): void {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`Guild ${GUILD_ID} not found in cache.`);
    return;
  }

  connection = joinVoiceChannel({
    channelId: VOICE_CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  // --- Connection lifecycle ---
  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log("[voice] Connection ready.");
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn("[voice] Disconnected – attempting reconnect...");
    try {
      // Wait up to 5 s for reconnect or move to the Connecting state
      await Promise.race([
        entersState(connection!, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection!, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Seems to be reconnecting automatically
    } catch {
      // Could not reconnect – destroy and retry
      console.warn("[voice] Reconnect failed – recreating connection.");
      connection?.destroy();
      setTimeout(() => connectToVoice(client), 3_000);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    console.log("[voice] Connection destroyed.");
    connection = null;
  });

  // --- Speaking detection via receiver ---
  const receiver = connection.receiver;

  receiver.speaking.on("start", (userId: string) => {
    // Clear any pending "stop" timer for this user
    const existing = speakingTimers.get(userId);
    if (existing) clearTimeout(existing);
    speakingTimers.delete(userId);

    postState("voice", { userId, speaking: true });
  });

  receiver.speaking.on("end", (userId: string) => {
    // Debounce: only fire "speaking: false" after a short quiet period
    const existing = speakingTimers.get(userId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      speakingTimers.delete(userId);
      postState("voice", { userId, speaking: false });
    }, SPEAKING_TIMEOUT_MS);

    speakingTimers.set(userId, timer);
  });
}

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Logged in as ${c.user.tag}`);
  connectToVoice(client);
  await pushVoiceUsers(client);
});

// Voice state changes (join / leave / move / mute / etc.)
client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  const isTargetChannel =
    oldState.channelId === VOICE_CHANNEL_ID ||
    newState.channelId === VOICE_CHANNEL_ID;

  if (!isTargetChannel) return;

  // If a user left the channel, immediately mark them as not speaking
  if (
    oldState.channelId === VOICE_CHANNEL_ID &&
    newState.channelId !== VOICE_CHANNEL_ID &&
    oldState.member &&
    !oldState.member.user.bot
  ) {
    const timer = speakingTimers.get(oldState.member.id);
    if (timer) clearTimeout(timer);
    speakingTimers.delete(oldState.member.id);
    await postState("voice", { userId: oldState.member.id, speaking: false });
  }

  // Always push the updated roster when someone joins/leaves/moves
  await pushVoiceUsers(client);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(): void {
  console.log("[bot] Shutting down...");

  // Clear all speaking timers
  for (const timer of speakingTimers.values()) clearTimeout(timer);
  speakingTimers.clear();

  // Destroy voice connection
  if (connection) {
    connection.destroy();
    connection = null;
  }

  // Destroy Discord client
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[bot] Failed to login:", err);
  process.exit(1);
});
