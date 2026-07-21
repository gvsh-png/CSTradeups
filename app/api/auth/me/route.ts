import { NextResponse } from "next/server";
import {
  authConfigured,
  authRequired,
  stripeConfigured,
} from "@/lib/auth/config";
import { getSession, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { getUser, quotaFromUser, upsertUser } from "@/lib/usage/store";
import {
  FREE_MAX_SAVED,
  FREE_WEEKLY_SCANS,
  PLAN_LABELS,
} from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/** Current user + quota for the UI */
export async function GET() {
  const configured = authConfigured();
  const required = authRequired();

  if (!configured) {
    return NextResponse.json({
      authConfigured: false,
      authRequired: false,
      stripeConfigured: stripeConfigured(),
      user: null,
      quota: null,
      limits: {
        freeWeeklyScans: FREE_WEEKLY_SCANS,
        freeMaxSaved: FREE_MAX_SAVED,
      },
    });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      authConfigured: true,
      authRequired: required,
      stripeConfigured: stripeConfigured(),
      user: null,
      quota: null,
      limits: {
        freeWeeklyScans: FREE_WEEKLY_SCANS,
        freeMaxSaved: FREE_MAX_SAVED,
      },
    });
  }

  let user = await getUser(session.steamId);
  if (!user) {
    user = await upsertUser(session);
  }

  // Keep session plan in sync with Redis (e.g. after Stripe webhook)
  if (user.plan !== session.plan) {
    const token = await createSessionToken({
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan,
    });
    const res = NextResponse.json({
      authConfigured: true,
      authRequired: required,
      stripeConfigured: stripeConfigured(),
      user: {
        steamId: user.steamId,
        name: user.name,
        avatar: user.avatar,
        plan: user.plan,
        planLabel: PLAN_LABELS[user.plan],
      },
      quota: quotaFromUser(user),
      limits: {
        freeWeeklyScans: FREE_WEEKLY_SCANS,
        freeMaxSaved: FREE_MAX_SAVED,
      },
    });
    const cookie = sessionCookieOptions(token);
    res.cookies.set(cookie.name, cookie.value, cookie);
    return res;
  }

  return NextResponse.json({
    authConfigured: true,
    authRequired: required,
    stripeConfigured: stripeConfigured(),
    user: {
      steamId: user.steamId,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan,
      planLabel: PLAN_LABELS[user.plan],
    },
    quota: quotaFromUser(user),
    limits: {
      freeWeeklyScans: FREE_WEEKLY_SCANS,
      freeMaxSaved: FREE_MAX_SAVED,
    },
  });
}
