import { NextResponse } from "next/server";
import { stateManager } from "@/lib/state";

export async function GET() {
  const connected = stateManager.isFoundryConnected();
  const lastHeartbeat = stateManager.getFoundryLastHeartbeat();
  const lastHeartbeatAgo = lastHeartbeat !== null ? Date.now() - lastHeartbeat : null;

  return NextResponse.json({ connected, lastHeartbeat, lastHeartbeatAgo });
}
