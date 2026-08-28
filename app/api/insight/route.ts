import { NextResponse } from "next/server";
import {
  MAX_INSIGHT_BODY_CHARS,
  allowInsightRequest,
  compactInsightTradeUp,
  insightClientKey,
} from "@/lib/insightGuard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured" },
      { status: 503 }
    );
  }

  if (!allowInsightRequest(insightClientKey(request))) {
    return NextResponse.json(
      { error: "Too many insight requests. Try again later." },
      { status: 429 }
    );
  }

  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_INSIGHT_BODY_CHARS) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const raw = await request.text();
    if (raw.length > MAX_INSIGHT_BODY_CHARS) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: { tradeUp?: unknown };
    try {
      body = JSON.parse(raw) as { tradeUp?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const compacted = compactInsightTradeUp(body.tradeUp);
    if (!compacted.ok) {
      return NextResponse.json({ error: compacted.error }, { status: 400 });
    }

    const model =
      process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tradeup-gen.vercel.app",
        "X-Title": "tradeupcsgo.net",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a CS2 trade-up contract analyst. Give brief, practical advice about trade-up contracts. Be concise (2-3 sentences). Focus on risk, float requirements, and market considerations.",
          },
          {
            role: "user",
            content: `Analyze this CS2 trade-up contract:\n${compacted.payload}`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `OpenRouter error: ${err.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const insight =
      data.choices?.[0]?.message?.content || "No insight available.";

    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Insight failed" },
      { status: 500 }
    );
  }
}
