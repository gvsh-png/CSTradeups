import { NextResponse } from "next/server";
import { authConfigured, authRequired } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import {
  claimSaveSlot,
  getUser,
  quotaFromUser,
  releaseSaveSlot,
  setSavedCount,
} from "@/lib/usage/store";

export const dynamic = "force-dynamic";

/** Sync / claim / release saved trade-up slots against the plan limit */
export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ ok: true, authConfigured: false });
  }

  const session = await getSession();
  if (!session) {
    if (authRequired()) {
      return NextResponse.json(
        { ok: false, error: "Sign in with Steam to save trade-ups.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    return NextResponse.json({ ok: true, authConfigured: true, user: null });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as "claim" | "release" | "sync" | undefined;

  if (action === "claim") {
    const result = await claimSaveSlot(session.steamId);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.reason,
          code: "SAVE_LIMIT",
          quota: result.quota,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, quota: result.quota });
  }

  if (action === "release") {
    const user = await releaseSaveSlot(session.steamId);
    return NextResponse.json({
      ok: true,
      quota: user ? quotaFromUser(user) : null,
    });
  }

  if (action === "sync") {
    const count = Number(body.savedCount);
    if (!Number.isFinite(count) || count < 0) {
      return NextResponse.json({ error: "Invalid savedCount" }, { status: 400 });
    }
    const user = await getUser(session.steamId);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const quota = quotaFromUser(user);
    if (quota.maxSaved != null && count > quota.maxSaved) {
      return NextResponse.json(
        {
          ok: false,
          error: `Free plan allows ${quota.maxSaved} saved trade-up. Remove extras or upgrade.`,
          code: "SAVE_LIMIT",
          quota,
        },
        { status: 403 }
      );
    }
    const next = await setSavedCount(session.steamId, count);
    return NextResponse.json({
      ok: true,
      quota: next ? quotaFromUser(next) : quota,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
