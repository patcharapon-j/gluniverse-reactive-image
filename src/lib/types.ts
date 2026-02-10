// ===== Player Slot =====

export interface ImageSet {
  healthyIdle: string | null;
  healthySpeaking: string | null;
  bloodiedIdle: string | null;
  bloodiedSpeaking: string | null;
}

export interface PlayerSlot {
  id: string;
  name: string;
  discordUserId: string | null;
  discordUsername: string | null;
  foundryActorId: string | null;
  foundryActorName: string | null;
  images: ImageSet;
  createdAt: string;
  updatedAt: string;
}

// ===== HP State =====

export type HpState = "healthy" | "bloodied";

export interface HpData {
  actorId: string;
  actorName: string;
  hp: number;
  maxHp: number;
}

export function getHpState(hp: number, maxHp: number): HpState {
  if (maxHp <= 0) return "healthy";
  return hp / maxHp >= 0.5 ? "healthy" : "bloodied";
}

// ===== Voice State =====

export interface VoiceStateUpdate {
  userId: string;
  speaking: boolean;
}

// ===== Overlay State (sent to browser sources) =====

export interface OverlayState {
  slotId: string;
  speaking: boolean;
  hpState: HpState;
  currentImage: string | null;
  connected: boolean;
}

// ===== Discord User (for config UI) =====

export interface DiscordUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

// ===== Foundry Actor (for config UI) =====

export interface FoundryActor {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
}

// ===== Discord Bot Config =====

export interface DiscordBotConfig {
  botToken: string;
  guildId: string;
  guildName: string;
  voiceChannelId: string;
  voiceChannelName: string;
  botUsername: string;
  configuredAt: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
}

// ===== Config =====

export interface AppConfig {
  slots: PlayerSlot[];
  defaultOverlayWidth: number;
  defaultOverlayHeight: number;
  discord?: DiscordBotConfig;
}

// ===== API payloads =====

export interface CreateSlotPayload {
  name: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  foundryActorId?: string | null;
  foundryActorName?: string | null;
}

export interface UpdateSlotPayload extends Partial<CreateSlotPayload> {}

export interface StateUpdatePayload {
  type: "voice" | "hp";
  data: VoiceStateUpdate | HpData;
}
