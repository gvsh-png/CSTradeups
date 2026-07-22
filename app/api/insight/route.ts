import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured" },
      { status: 503 }
    );
  }

  try {
    const { tradeUp } = await request.json();
    if (!tradeUp) {
      return NextResponse.json({ error: "No trade-up provided" }, { status: 400 });
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
            content: `Analyze this CS2 trade-up contract:\n${JSON.stringify(tradeUp, null, 2)}`,
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
