import { NextResponse } from "next/server";
import { stateManager } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = stateManager.getDiscordVoiceUsers();
  return NextResponse.json(users);
}
