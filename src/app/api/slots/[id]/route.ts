import { NextRequest, NextResponse } from "next/server";
import { getSlot, updateSlot, deleteSlot } from "@/lib/config";
import type { UpdateSlotPayload } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  return NextResponse.json(slot);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as UpdateSlotPayload;
    const slot = await updateSlot(id, body);
    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    return NextResponse.json(slot);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteSlot(id);
  if (!deleted) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
