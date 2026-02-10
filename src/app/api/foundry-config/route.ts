import { NextRequest, NextResponse } from "next/server";
import { getFoundryConfig, saveFoundryConfig, clearFoundryConfig } from "@/lib/config";

export async function GET() {
  const config = await getFoundryConfig();
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { foundryUrl } = body;

    if (!foundryUrl || typeof foundryUrl !== "string") {
      return NextResponse.json({ error: "foundryUrl is required" }, { status: 400 });
    }

    const config = {
      foundryUrl: foundryUrl.replace(/\/+$/, ""),
      configuredAt: new Date().toISOString(),
    };
    await saveFoundryConfig(config);
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE() {
  await clearFoundryConfig();
  return NextResponse.json({ success: true });
}
