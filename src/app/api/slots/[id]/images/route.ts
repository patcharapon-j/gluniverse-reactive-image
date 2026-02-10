import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getSlot, updateSlotImages } from "@/lib/config";
import type { ImageSet } from "@/lib/types";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const VALID_KEYS: (keyof ImageSet)[] = ["healthyIdle", "healthySpeaking", "bloodiedIdle", "bloodiedSpeaking"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const updates: Partial<ImageSet> = {};

    for (const key of VALID_KEYS) {
      const file = formData.get(key) as File | null;
      if (!file || !(file instanceof File)) continue;

      const ext = file.name.split(".").pop() || "png";
      const filename = `${id}-${key}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);
      updates[key] = `/uploads/${filename}`;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid image files provided" }, { status: 400 });
    }

    const updated = await updateSlotImages(id, updates);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to upload images" }, { status: 500 });
  }
}
