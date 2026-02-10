import { NextResponse } from "next/server";
import { getDiscordConfig, saveDiscordConfig, clearDiscordConfig, maskDiscordConfig } from "@/lib/config";
import type { DiscordBotConfig } from "@/lib/types";

export async function GET() {
  try {
    const discord = await getDiscordConfig();
    if (!discord) {
      return NextResponse.json(null);
    }
    return NextResponse.json(maskDiscordConfig(discord));
  } catch {
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: DiscordBotConfig = await request.json();

    if (!body.botToken || !body.guildId || !body.voiceChannelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const discord: DiscordBotConfig = {
      botToken: body.botToken,
      guildId: body.guildId,
      guildName: body.guildName,
      voiceChannelId: body.voiceChannelId,
      voiceChannelName: body.voiceChannelName,
      botUsername: body.botUsername,
      configuredAt: new Date().toISOString(),
    };

    await saveDiscordConfig(discord);
    return NextResponse.json(maskDiscordConfig(discord));
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearDiscordConfig();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to clear config" }, { status: 500 });
  }
}
