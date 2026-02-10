import { OverlayState, HpData, VoiceStateUpdate, getHpState, type HpState } from "./types";

interface SlotState {
  speaking: boolean;
  hp: number;
  maxHp: number;
  hpState: HpState;
}

type Listener = (slotId: string, state: OverlayState) => void;

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

  registerSlot(slotId: string, discordUserId: string | null, foundryActorId: string | null, images: { healthyIdle: string | null; healthySpeaking: string | null; bloodiedIdle: string | null; bloodiedSpeaking: string | null }) {
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
  }

  unregisterSlot(slotId: string) {
    this.slotStates.delete(slotId);
    this.slotImages.delete(slotId);
    for (const [uid, sid] of this.discordUserSlotMap) {
      if (sid === slotId) this.discordUserSlotMap.delete(uid);
    }
    for (const [aid, sid] of this.foundryActorSlotMap) {
      if (sid === slotId) this.foundryActorSlotMap.delete(aid);
    }
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
    if (!state || !images) {
      return { slotId, speaking: false, hpState: "healthy", currentImage: null, connected: true };
    }
    const imageKey = state.speaking
      ? (state.hpState === "healthy" ? "healthySpeaking" : "bloodiedSpeaking")
      : (state.hpState === "healthy" ? "healthyIdle" : "bloodiedIdle");
    return {
      slotId,
      speaking: state.speaking,
      hpState: state.hpState,
      currentImage: images[imageKey],
      connected: true,
    };
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
