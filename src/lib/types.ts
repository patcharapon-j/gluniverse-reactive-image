// ===== Utility Types =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

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
  overlaySettings?: DeepPartial<OverlaySettings>;
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

// ===== Overlay Settings =====

export type AnimationType = "none" | "bounce" | "pulse" | "shake" | "float" | "breathe" | "wiggle" | "rock" | "jello" | "flip" | "spin" | "rubberband";
export type AnimationDirection = "normal" | "reverse" | "alternate" | "alternate-reverse";
export type AnimationPlayMode = "continuous" | "one-shot";
export type OverlayObjectFit = "contain" | "cover" | "fill" | "none" | "scale-down";
export type VerticalAlign = "top" | "center" | "bottom";
export type HorizontalAlign = "left" | "center" | "right";
export type OverlayShape = "square" | "rounded" | "circle" | "hexagon" | "diamond";

export interface OverlaySizeSettings {
  width: number;
  height: number;
  objectFit: OverlayObjectFit;
  padding: number;
  verticalAlign: VerticalAlign;
  horizontalAlign: HorizontalAlign;
}

export interface OverlayIdleSettings {
  dim: boolean;
  brightness: number;
  opacity: number;
  transitionMs: number;
  grayscale: number;
  scale: number;
  blur: number;
}

export interface OverlaySpeakingSettings {
  brightness: number;
  opacity: number;
  transitionMs: number;
  scaleBoost: number;
}

export interface OverlayAnimationSettings {
  type: AnimationType;
  durationMs: number;
  intensity: number;
  easing: string;
  direction: AnimationDirection;
  playMode: AnimationPlayMode;
  delayMs: number;
}

export interface OverlayCrossfadeSettings {
  enabled: boolean;
  durationMs: number;
  easing: string;
}

export interface OverlayBloodiedSettings {
  redTint: number;
  pulse: boolean;
  pulseDurationMs: number;
  vignette: boolean;
  vignetteIntensity: number;
  saturationShift: number;
  intensity: number;
}

export interface OverlayVisualStyleSettings {
  speakingBorderEnabled: boolean;
  speakingBorderColor: string;
  speakingBorderWidth: number;
  speakingGlowEnabled: boolean;
  speakingGlowColor: string;
  speakingGlowSize: number;
  shadow: string;
  shape: OverlayShape;
  borderRadius: number;
  backgroundColor: string;
}

export interface OverlaySettings {
  size: OverlaySizeSettings;
  idle: OverlayIdleSettings;
  speaking: OverlaySpeakingSettings;
  animation: OverlayAnimationSettings;
  crossfade: OverlayCrossfadeSettings;
  bloodied: OverlayBloodiedSettings;
  visualStyle: OverlayVisualStyleSettings;
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  size: {
    width: 300,
    height: 400,
    objectFit: "contain",
    padding: 0,
    verticalAlign: "center",
    horizontalAlign: "center",
  },
  idle: {
    dim: true,
    brightness: 0.6,
    opacity: 0.7,
    transitionMs: 80,
    grayscale: 0,
    scale: 1.0,
    blur: 0,
  },
  speaking: {
    brightness: 1.0,
    opacity: 1.0,
    transitionMs: 50,
    scaleBoost: 1.0,
  },
  animation: {
    type: "bounce",
    durationMs: 600,
    intensity: 4,
    easing: "ease-in-out",
    direction: "normal",
    playMode: "continuous",
    delayMs: 0,
  },
  crossfade: {
    enabled: true,
    durationMs: 500,
    easing: "ease",
  },
  bloodied: {
    redTint: 0,
    pulse: false,
    pulseDurationMs: 2000,
    vignette: false,
    vignetteIntensity: 0.5,
    saturationShift: 0,
    intensity: 0.5,
  },
  visualStyle: {
    speakingBorderEnabled: false,
    speakingBorderColor: "#22c55e",
    speakingBorderWidth: 2,
    speakingGlowEnabled: false,
    speakingGlowColor: "#22c55e",
    speakingGlowSize: 10,
    shadow: "none",
    shape: "square",
    borderRadius: 0,
    backgroundColor: "transparent",
  },
};

export function resolveOverlaySettings(partial?: DeepPartial<OverlaySettings>): OverlaySettings {
  const d = DEFAULT_OVERLAY_SETTINGS;
  if (!partial) return { ...d };
  return {
    size: { ...d.size, ...partial.size },
    idle: { ...d.idle, ...partial.idle },
    speaking: { ...d.speaking, ...partial.speaking },
    animation: { ...d.animation, ...partial.animation },
    crossfade: { ...d.crossfade, ...partial.crossfade },
    bloodied: { ...d.bloodied, ...partial.bloodied },
    visualStyle: { ...d.visualStyle, ...partial.visualStyle },
  };
}

// ===== Overlay State (sent to browser sources) =====

export interface OverlayState {
  slotId: string;
  speaking: boolean;
  hpState: HpState;
  currentImage: string | null;
  overlaySettings: OverlaySettings;
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

// ===== Foundry VTT Config =====

export interface FoundryConfig {
  foundryUrl: string;
  configuredAt: string;
}

// ===== Config =====

export interface AppConfig {
  slots: PlayerSlot[];
  defaultOverlayWidth: number;
  defaultOverlayHeight: number;
  discord?: DiscordBotConfig;
  foundry?: FoundryConfig;
}

// ===== API payloads =====

export interface CreateSlotPayload {
  name: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
  foundryActorId?: string | null;
  foundryActorName?: string | null;
}

export interface UpdateSlotPayload extends Partial<CreateSlotPayload> {
  overlaySettings?: DeepPartial<OverlaySettings>;
}

export interface StateUpdatePayload {
  type: "voice" | "hp" | "foundry-heartbeat";
  data: VoiceStateUpdate | HpData;
}
