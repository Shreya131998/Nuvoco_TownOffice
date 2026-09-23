import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin authentication for the town office dashboard.
 *
 * Google Sheets has no user system, so a single shared password is issued to
 * the town office and exchanged for an HMAC-signed, httpOnly cookie. Stateless
 * — there is no session store and therefore no revocation short of rotating
 * AUTH_SECRET.
 *
 * This authenticates "an admin", not "which admin". Residents and maintenance
 * staff never log in at all: the complaint form is open and /resolve is keyed
 * on the token.
 */

const COOKIE = "town_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set to a random string of 16+ characters");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET);
}

/** Constant-time password check, so a wrong guess costs the same as a right one. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function makeSessionValue(): string {
  const issued = Date.now().toString();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${issued}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issued, nonce, mac] = parts;
  if (!safeEqual(mac, sign(`${issued}.${nonce}`))) return false;
  const age = (Date.now() - Number(issued)) / 1000;
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE;
}

export async function isAdmin(): Promise<boolean> {
  try {
    const jar = await cookies();
    return verifySessionValue(jar.get(COOKIE)?.value);
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;
