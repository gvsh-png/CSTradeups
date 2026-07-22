import { Redis } from "@upstash/redis";
import {
  currentWeekKey,
  type PlanId,
  maxSavedLimit,
  weeklyScanLimit,
} from "@/lib/billing/plans";

export type UserRecord = {
  steamId: string;
  name: string;
  avatar?: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  weekKey: string;
  weeklyScans: number;
  savedCount: number;
  createdAt: string;
  updatedAt: string;
};

function redis(): Redis {
  return Redis.fromEnv();
}

function userKey(steamId: string) {
  return `user:${steamId}`;
}

export async function getUser(steamId: string): Promise<UserRecord | null> {
  const raw = await redis().get<UserRecord>(userKey(steamId));
  return raw ?? null;
}

export async function upsertUser(
  input: Pick<UserRecord, "steamId" | "name" | "avatar"> &
    Partial<Pick<UserRecord, "plan">>
): Promise<UserRecord> {
  const existing = await getUser(input.steamId);
  const now = new Date().toISOString();
  const weekKey = currentWeekKey();

  const user: UserRecord = existing
    ? {
        ...existing,
        name: input.name,
        avatar: input.avatar ?? existing.avatar,
        plan: input.plan ?? existing.plan,
        weekKey:
          existing.weekKey === weekKey ? existing.weekKey : weekKey,
        weeklyScans:
          existing.weekKey === weekKey ? existing.weeklyScans : 0,
        updatedAt: now,
      }
    : {
        steamId: input.steamId,
        name: input.name,
        avatar: input.avatar,
        plan: input.plan ?? "free",
        weekKey,
        weeklyScans: 0,
        savedCount: 0,
        createdAt: now,
        updatedAt: now,
      };

  await redis().set(userKey(input.steamId), user);
  return user;
}

async function saveUser(user: UserRecord): Promise<UserRecord> {
  const next = { ...user, updatedAt: new Date().toISOString() };
  await redis().set(userKey(user.steamId), next);
  return next;
}

function rollWeek(user: UserRecord): UserRecord {
  const weekKey = currentWeekKey();
  if (user.weekKey === weekKey) return user;
  return { ...user, weekKey, weeklyScans: 0 };
}

export type QuotaSnapshot = {
  plan: PlanId;
  weeklyScans: number;
  weeklyScanLimit: number | null;
  weeklyScansRemaining: number | null;
  savedCount: number;
  maxSaved: number | null;
  canScan: boolean;
  canSave: boolean;
};

export function quotaFromUser(user: UserRecord): QuotaSnapshot {
  const u = rollWeek(user);
  const scanLimit = weeklyScanLimit(u.plan);
  const savedLimit = maxSavedLimit(u.plan);
  const weeklyScansRemaining =
    scanLimit == null ? null : Math.max(0, scanLimit - u.weeklyScans);

  return {
    plan: u.plan,
    weeklyScans: u.weeklyScans,
    weeklyScanLimit: scanLimit,
    weeklyScansRemaining,
    savedCount: u.savedCount,
    maxSaved: savedLimit,
    canScan: scanLimit == null || u.weeklyScans < scanLimit,
    canSave: savedLimit == null || u.savedCount < savedLimit,
  };
}

export async function consumeScan(
  steamId: string
): Promise<{ ok: true; user: UserRecord; quota: QuotaSnapshot } | { ok: false; reason: string; quota: QuotaSnapshot }> {
  const existing = await getUser(steamId);
  if (!existing) {
    return {
      ok: false,
      reason: "Account not found. Sign in with Steam again.",
      quota: quotaFromUser({
        steamId,
        name: "",
        plan: "free",
        weekKey: currentWeekKey(),
        weeklyScans: 0,
        savedCount: 0,
        createdAt: "",
        updatedAt: "",
      }),
    };
  }

  let user = rollWeek(existing);
  const scanLimit = weeklyScanLimit(user.plan);
  const weekKey = user.weekKey;
  const r = redis();

  // Atomic counter avoids concurrent free-tier overshoot
  if (scanLimit != null) {
    const counterKey = `quota:scans:${steamId}:${weekKey}`;
    const next = await r.incr(counterKey);
    if (next === 1) {
      await r.expire(counterKey, 60 * 60 * 24 * 14);
    }
    if (next > scanLimit) {
      await r.decr(counterKey);
      const quota = quotaFromUser({ ...user, weeklyScans: scanLimit });
      return {
        ok: false,
        reason: `Free plan allows ${scanLimit} scans per week. Upgrade to Pro for unlimited.`,
        quota,
      };
    }
    user = await saveUser({ ...user, weeklyScans: next });
    return { ok: true, user, quota: quotaFromUser(user) };
  }

  user = await saveUser({ ...user, weeklyScans: user.weeklyScans + 1 });
  return { ok: true, user, quota: quotaFromUser(user) };
}

export async function setSavedCount(
  steamId: string,
  savedCount: number
): Promise<UserRecord | null> {
  const existing = await getUser(steamId);
  if (!existing) return null;
  return saveUser({
    ...rollWeek(existing),
    savedCount: Math.max(0, Math.floor(savedCount)),
  });
}

export async function claimSaveSlot(
  steamId: string
): Promise<{ ok: true; user: UserRecord; quota: QuotaSnapshot } | { ok: false; reason: string; quota: QuotaSnapshot }> {
  const existing = await getUser(steamId);
  if (!existing) {
    return {
      ok: false,
      reason: "Sign in with Steam to save trade-ups.",
      quota: quotaFromUser({
        steamId,
        name: "",
        plan: "free",
        weekKey: currentWeekKey(),
        weeklyScans: 0,
        savedCount: 0,
        createdAt: "",
        updatedAt: "",
      }),
    };
  }

  const user = rollWeek(existing);
  const quota = quotaFromUser(user);
  if (!quota.canSave) {
    return {
      ok: false,
      reason: `Free plan allows ${quota.maxSaved} saved trade-up at a time. Remove one or upgrade to Pro.`,
      quota,
    };
  }

  const next = await saveUser({ ...user, savedCount: user.savedCount + 1 });
  return { ok: true, user: next, quota: quotaFromUser(next) };
}

export async function releaseSaveSlot(steamId: string): Promise<UserRecord | null> {
  const existing = await getUser(steamId);
  if (!existing) return null;
  const user = rollWeek(existing);
  return saveUser({
    ...user,
    savedCount: Math.max(0, user.savedCount - 1),
  });
}

export async function setPlan(
  steamId: string,
  plan: PlanId,
  stripe?: { customerId?: string; subscriptionId?: string | null }
): Promise<UserRecord | null> {
  const existing = await getUser(steamId);
  if (!existing) return null;
  return saveUser({
    ...rollWeek(existing),
    plan,
    stripeCustomerId: stripe?.customerId ?? existing.stripeCustomerId,
    stripeSubscriptionId:
      stripe?.subscriptionId === null
        ? undefined
        : stripe?.subscriptionId ?? existing.stripeSubscriptionId,
  });
}

export async function findByStripeCustomer(
  customerId: string
): Promise<UserRecord | null> {
  // Upstash doesn't support secondary indexes cheaply — store a pointer key
  const steamId = await redis().get<string>(`stripe:customer:${customerId}`);
  if (!steamId) return null;
  return getUser(steamId);
}

export async function linkStripeCustomer(
  steamId: string,
  customerId: string
): Promise<void> {
  await redis().set(`stripe:customer:${customerId}`, steamId);
  const user = await getUser(steamId);
  if (user) {
    await saveUser({ ...user, stripeCustomerId: customerId });
  }
}
