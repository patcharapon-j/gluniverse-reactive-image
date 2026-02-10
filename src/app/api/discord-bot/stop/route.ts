import { NextResponse } from "next/server";
import { stopBot, getBotStatus } from "@/lib/bot-process";

export async function POST() {
  try {
    const result = await stopBot();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Brief delay so the exit handler fires before we return status
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json(getBotStatus());
  } catch {
    return NextResponse.json({ error: "Failed to stop bot" }, { status: 500 });
  }
}
