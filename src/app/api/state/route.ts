import { NextRequest, NextResponse } from "next/server";
import { stateManager } from "@/lib/state";
import type { VoiceStateUpdate, HpData } from "@/lib/types";

function validateSecret(request: NextRequest): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return true; // No secret configured = allow all
  return request.headers.get("x-api-secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "voice": {
        const voiceData = data as VoiceStateUpdate;
        if (!voiceData.userId || typeof voiceData.speaking !== "boolean") {
          return NextResponse.json({ error: "Invalid voice state data" }, { status: 400 });
        }
        stateManager.handleVoiceState(voiceData);
        return NextResponse.json({ success: true });
      }

      case "hp": {
        const hpData = data as HpData;
        if (!hpData.actorId || typeof hpData.hp !== "number" || typeof hpData.maxHp !== "number") {
          return NextResponse.json({ error: "Invalid HP data" }, { status: 400 });
        }
        stateManager.handleHpUpdate(hpData);
        return NextResponse.json({ success: true });
      }

      case "voice-users": {
        const users = data as Array<{ id: string; username: string; displayName: string }>;
        if (!Array.isArray(users)) {
          return NextResponse.json({ error: "Invalid voice users data" }, { status: 400 });
        }
        stateManager.setDiscordVoiceUsers(users);
        return NextResponse.json({ success: true });
      }

      case "roster":
      case "foundry-actors": {
        const actors = data as Array<{ id: string; name: string; hp: number; maxHp: number }>;
        if (!Array.isArray(actors)) {
          return NextResponse.json({ error: "Invalid actors data" }, { status: 400 });
        }
        stateManager.setFoundryActors(actors);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
