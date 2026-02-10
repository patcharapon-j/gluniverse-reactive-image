import { NextRequest, NextResponse } from "next/server";
import { getSlot, updateSlotOverlaySettings } from "@/lib/config";
import { resolveOverlaySettings } from "@/lib/types";
import type { DeepPartial, OverlaySettings } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  return NextResponse.json(resolveOverlaySettings(slot.overlaySettings));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as DeepPartial<OverlaySettings>;
    const slot = await updateSlotOverlaySettings(id, body);
    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    return NextResponse.json(resolveOverlaySettings(slot.overlaySettings));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
