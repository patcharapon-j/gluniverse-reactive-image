import { NextRequest, NextResponse } from "next/server";
import { getSlots, createSlot } from "@/lib/config";
import type { CreateSlotPayload } from "@/lib/types";

export async function GET() {
  const slots = await getSlots();
  return NextResponse.json(slots);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateSlotPayload;
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const slot = await createSlot(body);
    return NextResponse.json(slot, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
