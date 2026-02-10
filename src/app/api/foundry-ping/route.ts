import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { foundryUrl } = body;

    if (!foundryUrl || typeof foundryUrl !== "string") {
      return NextResponse.json({ ok: false, message: "No Foundry URL provided" });
    }

    const url = foundryUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${url}/api/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return NextResponse.json({ ok: true, message: `Foundry VTT is reachable at ${url}` });
      }

      // Foundry might not have /api/status, try the root
      const rootRes = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (rootRes.ok) {
        return NextResponse.json({ ok: true, message: `Foundry VTT is reachable at ${url}` });
      }

      return NextResponse.json({ ok: false, message: `Foundry responded with status ${rootRes.status}` });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ ok: false, message: "Connection timed out (5s). Check the URL and make sure Foundry is running." });
      }
      return NextResponse.json({ ok: false, message: `Cannot reach ${url}. Make sure Foundry is running and the URL is correct.` });
    }
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request" });
  }
}
