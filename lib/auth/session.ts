import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PlanId } from "@/lib/billing/plans";
import { appBaseUrl } from "./config";

export const SESSION_COOKIE = "tradeup_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  steamId: string;
  name: string;
  avatar?: string;
  plan: PlanId;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  user: SessionUser
): Promise<string> {
  return new SignJWT({
    steamId: user.steamId,
    name: user.name,
    avatar: user.avatar,
    plan: user.plan,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .setIssuer(appBaseUrl())
    .sign(secretKey());
}

export async function readSessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: appBaseUrl(),
    });
    if (typeof payload.steamId !== "string") return null;
    return {
      steamId: payload.steamId,
      name: typeof payload.name === "string" ? payload.name : "Steam User",
      avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
      plan: payload.plan === "pro" ? "pro" : "free",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
