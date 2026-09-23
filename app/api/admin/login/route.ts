import { NextResponse } from "next/server";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, isAuthConfigured, makeSessionValue,
} from "@/lib/auth";
import { allow, clientIp, reset } from "@/lib/ratelimit";

/** Failures are counted per IP so the shared password cannot be brute-forced
 *  at full speed. Per-instance only — good enough to blunt a script, and the
 *  delay below costs a real admin nothing. */
const WINDOW = 15 * 60_000;
const MAX_ATTEMPTS = 10;

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured. Set ADMIN_PASSWORD and AUTH_SECRET." },
      { status: 500 }
    );
  }

  const ip = clientIp(req);
  if (!allow("login", ip, MAX_ATTEMPTS, WINDOW)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!checkPassword(password)) {
    // A deliberate pause: makes an online guessing run slow without being
    // noticeable to someone who typed their own password wrong.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // A correct password clears the counter, so a typo earlier in the day does
  // not lock out the person who then gets it right.
  reset("login", ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
