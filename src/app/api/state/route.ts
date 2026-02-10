import { NextRequest, NextResponse } from "next/server";
import { stateManager } from "@/lib/state";
import type { VoiceStateUpdate, HpData } from "@/lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-secret",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function validateSecret(request: NextRequest): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return true; // No secret configured = allow all
  return request.headers.get("x-api-secret") === secret;
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  if (!validateSecret(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "voice": {
        const voiceData = data as VoiceStateUpdate;
        if (!voiceData.userId || typeof voiceData.speaking !== "boolean") {
          return json({ error: "Invalid voice state data" }, 400);
        }
        stateManager.handleVoiceState(voiceData);
        return json({ success: true });
      }

      case "hp": {
        const hpData = data as HpData;
        if (!hpData.actorId || typeof hpData.hp !== "number" || typeof hpData.maxHp !== "number") {
          return json({ error: "Invalid HP data" }, 400);
        }
        stateManager.handleHpUpdate(hpData);
        return json({ success: true });
      }

      case "voice-users": {
        const users = data as Array<{ id: string; username: string; displayName: string }>;
        if (!Array.isArray(users)) {
          return json({ error: "Invalid voice users data" }, 400);
        }
        stateManager.setDiscordVoiceUsers(users);
        return json({ success: true });
      }

      case "roster":
      case "foundry-actors": {
        if (!Array.isArray(data)) {
          return json({ error: "Invalid actors data" }, 400);
        }
        // Foundry module sends actorId/actorName, normalize to id/name
        const actors = data.map((a: Record<string, unknown>) => ({
          id: (a.actorId ?? a.id) as string,
          name: (a.actorName ?? a.name) as string,
          hp: a.hp as number,
          maxHp: a.maxHp as number,
        }));
        stateManager.setFoundryActors(actors);
        return json({ success: true });
      }

      case "foundry-heartbeat": {
        stateManager.handleFoundryHeartbeat();
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown type: ${type}` }, 400);
    }
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
}
