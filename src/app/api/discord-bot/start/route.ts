import { NextResponse } from "next/server";
import { startBot, getBotStatus } from "@/lib/bot-process";
import { getDiscordConfig } from "@/lib/config";

export async function POST() {
  try {
    const config = await getDiscordConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Discord bot is not configured. Complete setup first." },
        { status: 400 }
      );
    }

    const result = startBot();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json(getBotStatus());
  } catch {
    return NextResponse.json({ error: "Failed to start bot" }, { status: 500 });
  }
}
