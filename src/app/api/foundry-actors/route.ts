import { NextResponse } from "next/server";
import { stateManager } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const actors = stateManager.getFoundryActors();
  return NextResponse.json(actors);
}
