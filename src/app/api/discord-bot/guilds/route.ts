import { NextResponse } from "next/server";
import type { DiscordGuild } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch guilds" }, { status: res.status });
    }

    const guilds: DiscordGuild[] = (await res.json()).map((g: DiscordGuild) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
    }));

    return NextResponse.json(guilds);
  } catch {
    return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
  }
}
