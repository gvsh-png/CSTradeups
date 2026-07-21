import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Hosts allowed for skin image proxy (PNG export / CORS bypass) */
const ALLOWED_HOSTS = new Set([
  "community.cloudflare.steamstatic.com",
  "community.akamai.steamstatic.com",
  "community.steamstatic.com",
  "steamcdn-a.akamaihd.net",
  "cdn.steamstatic.com",
  "steamcommunity-a.akamaihd.net",
]);

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("u");
    if (!raw) {
      return NextResponse.json({ error: "Missing u" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "TradeUpGen/1.0",
      },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        // Required so html-to-image / canvas can read pixels
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy failed" },
      { status: 500 }
    );
  }
}
