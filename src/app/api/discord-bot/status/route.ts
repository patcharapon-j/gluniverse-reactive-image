import { NextResponse } from "next/server";
import { getBotStatus } from "@/lib/bot-process";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getBotStatus());
}
