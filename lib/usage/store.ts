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

function userLockKey(steamId: string) {
  return `user:lock:${steamId}`;
}

export async function getUser(steamId: string): Promise<UserRecord | null> {
  const raw = await redis().get<UserRecord>(userKey(steamId));
  return raw ?? null;
}

/**
 * Serialize read-modify-write on a user record.
 * Without this, scan/save/login full-document SETs race Stripe setPlan and
 * can silently downgrade a paid user back to free.
 */
async function withUserLock<T>(
  steamId: string,
  fn: () => Promise<T>
): Promise<T> {
  const r = redis();
  const lockKey = userLockKey(steamId);
  for (let attempt = 0; attempt < 12; attempt++) {
    const locked = await r.set(lockKey, "1", { nx: true, px: 5_000 });
    if (locked) {
      try {
        return await fn();
      } finally {
        await r.del(lockKey);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
  throw new Error("Could not update account — please retry.");
}

async function saveUserLocked(user: UserRecord): Promise<UserRecord> {
  const next = { ...user, updatedAt: new Date().toISOString() };
  await redis().set(userKey(user.steamId), next);
  return next;
}

export async function upsertUser(
  input: Pick<UserRecord, "steamId" | "name" | "avatar"> &
    Partial<Pick<UserRecord, "plan">>
): Promise<UserRecord> {
  return withUserLock(input.steamId, async () => {
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
  });
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
  const missingQuota = (): QuotaSnapshot =>
    quotaFromUser({
      steamId,
      name: "",
      plan: "free",
      weekKey: currentWeekKey(),
      weeklyScans: 0,
      savedCount: 0,
      createdAt: "",
      updatedAt: "",
    });

  try {
    return await withUserLock(steamId, async () => {
      const existing = await getUser(steamId);
      if (!existing) {
        return {
          ok: false as const,
          reason: "Account not found. Sign in with Steam again.",
          quota: missingQuota(),
        };
      }

      let user = rollWeek(existing);
      const scanLimit = weeklyScanLimit(user.plan);
      const weekKey = user.weekKey;
      const r = redis();

      // Atomic counter avoids concurrent free-tier overshoot across instances
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
            ok: false as const,
            reason: `Free plan allows ${scanLimit} scans per week. Upgrade to Pro for unlimited.`,
            quota,
          };
        }
        user = await saveUserLocked({ ...user, weeklyScans: next });
        return { ok: true as const, user, quota: quotaFromUser(user) };
      }

      user = await saveUserLocked({
        ...user,
        weeklyScans: user.weeklyScans + 1,
      });
      return { ok: true as const, user, quota: quotaFromUser(user) };
    });
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Could not update account — please retry.",
      quota: missingQuota(),
    };
  }
}

export async function setSavedCount(
  steamId: string,
  savedCount: number
): Promise<UserRecord | null> {
  return withUserLock(steamId, async () => {
    const existing = await getUser(steamId);
    if (!existing) return null;
    return saveUserLocked({
      ...rollWeek(existing),
      savedCount: Math.max(0, Math.floor(savedCount)),
    });
  });
}

export async function claimSaveSlot(
  steamId: string
): Promise<{ ok: true; user: UserRecord; quota: QuotaSnapshot } | { ok: false; reason: string; quota: QuotaSnapshot }> {
  const missingQuota = (): QuotaSnapshot =>
    quotaFromUser({
      steamId,
      name: "",
      plan: "free",
      weekKey: currentWeekKey(),
      weeklyScans: 0,
      savedCount: 0,
      createdAt: "",
      updatedAt: "",
    });

  try {
    return await withUserLock(steamId, async () => {
      const existing = await getUser(steamId);
      if (!existing) {
        return {
          ok: false as const,
          reason: "Sign in with Steam to save trade-ups.",
          quota: missingQuota(),
        };
      }

      const user = rollWeek(existing);
      const quota = quotaFromUser(user);
      if (!quota.canSave) {
        return {
          ok: false as const,
          reason: `Free plan allows ${quota.maxSaved} saved trade-up at a time. Remove one or upgrade to Pro.`,
          quota,
        };
      }

      const next = await saveUserLocked({
        ...user,
        savedCount: user.savedCount + 1,
      });
      return { ok: true as const, user: next, quota: quotaFromUser(next) };
    });
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? err.message
          : "Could not update account — please retry.",
      quota: missingQuota(),
    };
  }
}

export async function releaseSaveSlot(steamId: string): Promise<UserRecord | null> {
  return withUserLock(steamId, async () => {
    const existing = await getUser(steamId);
    if (!existing) return null;
    const user = rollWeek(existing);
    return saveUserLocked({
      ...user,
      savedCount: Math.max(0, user.savedCount - 1),
    });
  });
}

export async function setPlan(
  steamId: string,
  plan: PlanId,
  stripe?: { customerId?: string; subscriptionId?: string | null }
): Promise<UserRecord | null> {
  return withUserLock(steamId, async () => {
    const existing = await getUser(steamId);
    if (!existing) return null;
    return saveUserLocked({
      ...rollWeek(existing),
      plan,
      stripeCustomerId: stripe?.customerId ?? existing.stripeCustomerId,
      stripeSubscriptionId:
        stripe?.subscriptionId === null
          ? undefined
          : stripe?.subscriptionId ?? existing.stripeSubscriptionId,
    });
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
  await withUserLock(steamId, async () => {
    const user = await getUser(steamId);
    if (user) {
      await saveUserLocked({ ...user, stripeCustomerId: customerId });
    }
  });
}
