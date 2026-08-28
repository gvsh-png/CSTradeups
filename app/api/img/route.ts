import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Hosts allowed for skin image proxy (PNG export / CORS bypass) */
const ALLOWED_HOSTS = new Set([
  "community.cloudflare.steamstatic.com",
  "community.akamai.steamstatic.com",
  "community.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "cdn.cloudflare.steamstatic.com",
  "steamcdn-a.akamaihd.net",
  "cdn.steamstatic.com",
  "steamcommunity-a.akamaihd.net",
]);

/** Cap proxy buffer so a huge upstream body cannot OOM the route */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 3;

function rewriteSteamCdn(url: URL): URL {
  // Prefer Cloudflare edge when Akamai blocks datacenter IPs
  if (url.hostname === "community.akamai.steamstatic.com") {
    const next = new URL(url.toString());
    next.hostname = "community.cloudflare.steamstatic.com";
    return next;
  }
  return url;
}

function isAllowedImageUrl(url: URL): boolean {
  return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
}

/**
 * Fetch an allowlisted image without open redirect SSRF.
 * Default fetch() follows redirects to any host — re-check each hop.
 */
async function fetchAllowedImage(start: URL): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isAllowedImageUrl(current)) return null;

    const res = await fetch(current.toString(), {
      redirect: "manual",
      headers: {
        Accept: "image/png,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; tradeupcsgo.net/1.0)",
        Referer: "https://steamcommunity.com/",
      },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 86400 },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        current = new URL(loc, current);
      } catch {
        return null;
      }
      continue;
    }

    return res;
  }
  return null;
}

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

    if (!isAllowedImageUrl(target)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const candidates = [target, rewriteSteamCdn(target)].filter(
      (u, i, arr) => arr.findIndex((x) => x.href === u.href) === i
    );

    let upstream: Response | null = null;
    for (const candidate of candidates) {
      upstream = await fetchAllowedImage(candidate);
      if (upstream?.ok) break;
    }

    if (!upstream || !upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream?.status ?? 502}` },
        { status: upstream?.status ?? 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const declared = upstream.headers.get("content-length");
    if (declared && Number(declared) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

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
