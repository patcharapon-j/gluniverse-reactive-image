import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { AppConfig, PlayerSlot, CreateSlotPayload, UpdateSlotPayload, ImageSet, DiscordBotConfig, FoundryConfig, DeepPartial, OverlaySettings } from "./types";
import { stateManager } from "./state";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

const DEFAULT_CONFIG: AppConfig = {
  slots: [],
  defaultOverlayWidth: 300,
  defaultOverlayHeight: 400,
};

let cachedConfig: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    cachedConfig = JSON.parse(raw) as AppConfig;
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  // Register all slots in state manager
  for (const slot of cachedConfig.slots) {
    stateManager.registerSlot(slot.id, slot.discordUserId, slot.foundryActorId, slot.images, slot.overlaySettings);
  }
  return cachedConfig;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  cachedConfig = config;
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function getSlots(): Promise<PlayerSlot[]> {
  const config = await loadConfig();
  return config.slots;
}

export async function getSlot(id: string): Promise<PlayerSlot | undefined> {
  const config = await loadConfig();
  return config.slots.find((s) => s.id === id);
}

export async function createSlot(payload: CreateSlotPayload): Promise<PlayerSlot> {
  const config = await loadConfig();
  if (config.slots.length >= 7) {
    throw new Error("Maximum 7 slots allowed");
  }
  const now = new Date().toISOString();
  const slot: PlayerSlot = {
    id: uuidv4(),
    name: payload.name,
    discordUserId: payload.discordUserId ?? null,
    discordUsername: payload.discordUsername ?? null,
    foundryActorId: payload.foundryActorId ?? null,
    foundryActorName: payload.foundryActorName ?? null,
    images: {
      healthyIdle: null,
      healthySpeaking: null,
      bloodiedIdle: null,
      bloodiedSpeaking: null,
    },
    createdAt: now,
    updatedAt: now,
  };
  config.slots.push(slot);
  await saveConfig(config);
  stateManager.registerSlot(slot.id, slot.discordUserId, slot.foundryActorId, slot.images, slot.overlaySettings);
  return slot;
}

export async function updateSlot(id: string, payload: UpdateSlotPayload): Promise<PlayerSlot | null> {
  const config = await loadConfig();
  const idx = config.slots.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const slot = config.slots[idx];
  if (payload.name !== undefined) slot.name = payload.name;
  if (payload.discordUserId !== undefined) slot.discordUserId = payload.discordUserId ?? null;
  if (payload.discordUsername !== undefined) slot.discordUsername = payload.discordUsername ?? null;
  if (payload.foundryActorId !== undefined) slot.foundryActorId = payload.foundryActorId ?? null;
  if (payload.foundryActorName !== undefined) slot.foundryActorName = payload.foundryActorName ?? null;
  if (payload.overlaySettings !== undefined) slot.overlaySettings = payload.overlaySettings;
  slot.updatedAt = new Date().toISOString();
  config.slots[idx] = slot;
  await saveConfig(config);
  stateManager.registerSlot(slot.id, slot.discordUserId, slot.foundryActorId, slot.images, slot.overlaySettings);
  return slot;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const config = await loadConfig();
  const idx = config.slots.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  config.slots.splice(idx, 1);
  await saveConfig(config);
  stateManager.unregisterSlot(id);
  return true;
}

// ===== Discord Bot Config =====

export async function getDiscordConfig(): Promise<DiscordBotConfig | null> {
  const config = await loadConfig();
  return config.discord ?? null;
}

export async function saveDiscordConfig(discord: DiscordBotConfig): Promise<void> {
  const config = await loadConfig();
  config.discord = discord;
  await saveConfig(config);
}

export async function clearDiscordConfig(): Promise<void> {
  const config = await loadConfig();
  delete config.discord;
  await saveConfig(config);
}

export function maskDiscordConfig(discord: DiscordBotConfig): Omit<DiscordBotConfig, "botToken"> & { botToken: string; botTokenMasked: string } {
  const lastFour = discord.botToken.slice(-4);
  return {
    ...discord,
    botToken: "",
    botTokenMasked: `****${lastFour}`,
  };
}

// ===== Foundry VTT Config =====

export async function getFoundryConfig(): Promise<FoundryConfig | null> {
  const config = await loadConfig();
  return config.foundry ?? null;
}

export async function saveFoundryConfig(foundry: FoundryConfig): Promise<void> {
  const config = await loadConfig();
  config.foundry = foundry;
  await saveConfig(config);
}

export async function clearFoundryConfig(): Promise<void> {
  const config = await loadConfig();
  delete config.foundry;
  await saveConfig(config);
}

export async function updateSlotOverlaySettings(id: string, overlaySettings: DeepPartial<OverlaySettings>): Promise<PlayerSlot | null> {
  const config = await loadConfig();
  const idx = config.slots.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const slot = config.slots[idx];
  slot.overlaySettings = overlaySettings;
  slot.updatedAt = new Date().toISOString();
  config.slots[idx] = slot;
  await saveConfig(config);
  stateManager.updateSlotOverlaySettings(slot.id, overlaySettings);
  return slot;
}

export async function updateSlotImages(id: string, images: Partial<ImageSet>): Promise<PlayerSlot | null> {
  const config = await loadConfig();
  const idx = config.slots.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const slot = config.slots[idx];
  if (images.healthyIdle !== undefined) slot.images.healthyIdle = images.healthyIdle;
  if (images.healthySpeaking !== undefined) slot.images.healthySpeaking = images.healthySpeaking;
  if (images.bloodiedIdle !== undefined) slot.images.bloodiedIdle = images.bloodiedIdle;
  if (images.bloodiedSpeaking !== undefined) slot.images.bloodiedSpeaking = images.bloodiedSpeaking;
  slot.updatedAt = new Date().toISOString();
  config.slots[idx] = slot;
  await saveConfig(config);
  stateManager.registerSlot(slot.id, slot.discordUserId, slot.foundryActorId, slot.images, slot.overlaySettings);
  return slot;
}
