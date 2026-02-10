import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: "Invalid token" }, { status: 401 });
    }

    const bot = await res.json();
    return NextResponse.json({
      valid: true,
      bot: { id: bot.id, username: bot.username },
    });
  } catch {
    return NextResponse.json({ error: "Failed to validate token" }, { status: 500 });
  }
}
