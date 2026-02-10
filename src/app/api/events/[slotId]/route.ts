import { NextRequest } from "next/server";
import { stateManager } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialState = stateManager.getOverlayState(slotId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialState)}\n\n`));

      // Subscribe to state changes
      const unsubscribe = stateManager.subscribe((changedSlotId, state) => {
        if (changedSlotId === slotId) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
          } catch {
            // Stream closed
            unsubscribe();
          }
        }
      });

      // Send keepalive every 15s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          unsubscribe();
        }
      }, 15000);

      // Cleanup when client disconnects
      _request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
