import { OverlayState, HpData, VoiceStateUpdate, getHpState, resolveOverlaySettings, type HpState, type DeepPartial, type OverlaySettings } from "./types";

interface SlotState {
  speaking: boolean;
  hp: number;
  maxHp: number;
  hpState: HpState;
}

type Listener = (slotId: string, state: OverlayState) => void;

const FOUNDRY_HEARTBEAT_TIMEOUT_MS = 90_000; // 3x the 30s heartbeat interval
const FOUNDRY_HEARTBEAT_CHECK_MS = 15_000;   // Check for staleness every 15s

class StateManager {
  private slotStates: Map<string, SlotState> = new Map();
  private listeners: Set<Listener> = new Set();
  // Maps discordUserId -> slotId
  private discordUserSlotMap: Map<string, string> = new Map();
  // Maps foundryActorId -> slotId
  private foundryActorSlotMap: Map<string, string> = new Map();
  // Discord users in voice channel
  private discordVoiceUsers: Map<string, { id: string; username: string; displayName: string }> = new Map();
  // Foundry actors roster
  private foundryActors: Map<string, { id: string; name: string; hp: number; maxHp: number }> = new Map();
  // Image mappings: slotId -> images
  private slotImages: Map<string, { healthyIdle: string | null; healthySpeaking: string | null; bloodiedIdle: string | null; bloodiedSpeaking: string | null }> = new Map();
  // Overlay settings per slot
  private slotOverlaySettings: Map<string, DeepPartial<OverlaySettings>> = new Map();
  // Foundry heartbeat tracking
  private foundryLastHeartbeat: number | null = null;
  private foundryHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically check if Foundry has gone stale and notify SSE subscribers
    this.foundryHeartbeatTimer = setInterval(() => {
      this.checkFoundryHeartbeat();
    }, FOUNDRY_HEARTBEAT_CHECK_MS);
  }

  private checkFoundryHeartbeat() {
    if (this.foundryLastHeartbeat === null) return;
    const now = Date.now();
    const wasConnected = (now - FOUNDRY_HEARTBEAT_CHECK_MS) - this.foundryLastHeartbeat < FOUNDRY_HEARTBEAT_TIMEOUT_MS;
    const isNowConnected = now - this.foundryLastHeartbeat < FOUNDRY_HEARTBEAT_TIMEOUT_MS;
    // If transitioning from connected to disconnected, notify all slots
    if (wasConnected && !isNowConnected) {
      this.notifyAllSlots();
    }
  }

  private notifyAllSlots() {
    for (const slotId of this.slotStates.keys()) {
      this.notify(slotId);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(slotId: string) {
    const state = this.getOverlayState(slotId);
    for (const listener of this.listeners) {
      listener(slotId, state);
    }
  }

  registerSlot(slotId: string, discordUserId: string | null, foundryActorId: string | null, images: { healthyIdle: string | null; healthySpeaking: string | null; bloodiedIdle: string | null; bloodiedSpeaking: string | null }, overlaySettings?: DeepPartial<OverlaySettings>) {
    if (!this.slotStates.has(slotId)) {
      this.slotStates.set(slotId, { speaking: false, hp: 100, maxHp: 100, hpState: "healthy" });
    }
    // Clean up old mappings for this slot
    for (const [uid, sid] of this.discordUserSlotMap) {
      if (sid === slotId) this.discordUserSlotMap.delete(uid);
    }
    for (const [aid, sid] of this.foundryActorSlotMap) {
      if (sid === slotId) this.foundryActorSlotMap.delete(aid);
    }
    if (discordUserId) this.discordUserSlotMap.set(discordUserId, slotId);
    if (foundryActorId) this.foundryActorSlotMap.set(foundryActorId, slotId);
    this.slotImages.set(slotId, images);
    if (overlaySettings) {
      this.slotOverlaySettings.set(slotId, overlaySettings);
    }
  }

  unregisterSlot(slotId: string) {
    this.slotStates.delete(slotId);
    this.slotImages.delete(slotId);
    this.slotOverlaySettings.delete(slotId);
    for (const [uid, sid] of this.discordUserSlotMap) {
      if (sid === slotId) this.discordUserSlotMap.delete(uid);
    }
    for (const [aid, sid] of this.foundryActorSlotMap) {
      if (sid === slotId) this.foundryActorSlotMap.delete(aid);
    }
  }

  updateSlotOverlaySettings(slotId: string, settings: DeepPartial<OverlaySettings>) {
    this.slotOverlaySettings.set(slotId, settings);
    this.notify(slotId);
  }

  handleVoiceState(update: VoiceStateUpdate) {
    const slotId = this.discordUserSlotMap.get(update.userId);
    if (!slotId) return;
    const state = this.slotStates.get(slotId);
    if (!state) return;
    state.speaking = update.speaking;
    this.notify(slotId);
  }

  handleHpUpdate(data: HpData) {
    this.refreshFoundryHeartbeat();
    const slotId = this.foundryActorSlotMap.get(data.actorId);
    if (!slotId) return;
    const state = this.slotStates.get(slotId);
    if (!state) return;
    state.hp = data.hp;
    state.maxHp = data.maxHp;
    state.hpState = getHpState(data.hp, data.maxHp);
    this.notify(slotId);
  }

  setDiscordVoiceUsers(users: Array<{ id: string; username: string; displayName: string }>) {
    this.discordVoiceUsers.clear();
    for (const u of users) {
      this.discordVoiceUsers.set(u.id, u);
    }
  }

  getDiscordVoiceUsers() {
    return Array.from(this.discordVoiceUsers.values());
  }

  setFoundryActors(actors: Array<{ id: string; name: string; hp: number; maxHp: number }>) {
    this.refreshFoundryHeartbeat();
    this.foundryActors.clear();
    for (const a of actors) {
      this.foundryActors.set(a.id, a);
    }
  }

  getFoundryActors() {
    return Array.from(this.foundryActors.values());
  }

  getOverlayState(slotId: string): OverlayState {
    const state = this.slotStates.get(slotId);
    const images = this.slotImages.get(slotId);
    const settingsPartial = this.slotOverlaySettings.get(slotId);
    if (!state || !images) {
      return { slotId, speaking: false, hpState: "healthy", currentImage: null, overlaySettings: resolveOverlaySettings(settingsPartial), connected: this.isFoundryConnected() };
    }
    const imageKey = state.speaking
      ? (state.hpState === "healthy" ? "healthySpeaking" : "bloodiedSpeaking")
      : (state.hpState === "healthy" ? "healthyIdle" : "bloodiedIdle");
    return {
      slotId,
      speaking: state.speaking,
      hpState: state.hpState,
      currentImage: images[imageKey],
      overlaySettings: resolveOverlaySettings(settingsPartial),
      connected: this.isFoundryConnected(),
    };
  }

  handleFoundryHeartbeat() {
    this.refreshFoundryHeartbeat();
  }

  isFoundryConnected(): boolean {
    if (this.foundryLastHeartbeat === null) return false;
    return Date.now() - this.foundryLastHeartbeat < FOUNDRY_HEARTBEAT_TIMEOUT_MS;
  }

  getFoundryLastHeartbeat(): number | null {
    return this.foundryLastHeartbeat;
  }

  private refreshFoundryHeartbeat() {
    const wasConnected = this.isFoundryConnected();
    this.foundryLastHeartbeat = Date.now();
    // If transitioning from disconnected to connected, notify all slots
    if (!wasConnected) {
      this.notifyAllSlots();
    }
  }

  getAllSlotStates(): Map<string, OverlayState> {
    const result = new Map<string, OverlayState>();
    for (const slotId of this.slotStates.keys()) {
      result.set(slotId, this.getOverlayState(slotId));
    }
    return result;
  }
}

// Singleton
export const stateManager = new StateManager();
