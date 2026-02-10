import { NextResponse } from "next/server";
import type { DiscordChannel } from "@/lib/types";

// Discord channel types: 2 = GUILD_VOICE, 13 = GUILD_STAGE_VOICE
const VOICE_CHANNEL_TYPES = [2, 13];

export async function POST(request: Request) {
  try {
    const { token, guildId } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (!guildId || typeof guildId !== "string") {
      return NextResponse.json({ error: "Guild ID is required" }, { status: 400 });
    }

    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch channels" }, { status: res.status });
    }

    const allChannels: DiscordChannel[] = await res.json();
    const voiceChannels = allChannels
      .filter((c) => VOICE_CHANNEL_TYPES.includes(c.type))
      .map((c) => ({ id: c.id, name: c.name, type: c.type, position: c.position }))
      .sort((a, b) => a.position - b.position);

    return NextResponse.json(voiceChannels);
  } catch {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
