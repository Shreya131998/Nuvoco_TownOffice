import { NextResponse } from "next/server";
import {
  BadRequest,
  checkAccessCode,
  fail,
  optStr,
  personName,
  str,
} from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { assertOurUrl, isCloudinaryConfigured } from "@/lib/cloudinary";
import { normaliseToken } from "@/lib/token";
import { submitResolution } from "@/lib/sheets/store";
import type { Outcome } from "@/lib/types";

/**
 * The only writer into the Resolutions tab.
 *
 * Open by design: the token is the key, so maintenance staff do not need
 * accounts. The trade-off is that a resident holding their own token could
 * close their own complaint — set STAFF_ACCESS_CODE to gate this behind one
 * shared code if that turns out to matter.
 */

const OUTCOMES: Outcome[] = ["resolved", "partial", "not_possible"];
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;

export async function POST(req: Request) {
  try {
    checkAccessCode(req);

    const ip = clientIp(req);
    if (!allow("resolve", ip, MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new BadRequest("Invalid request");

    const token = normaliseToken(String(body.token ?? ""));
    if (!token) {
      throw new BadRequest("A token is 6 characters, like 7K3M9P");
    }

    const outcome = body.outcome as Outcome;
    if (!OUTCOMES.includes(outcome)) {
      throw new BadRequest("Please choose what happened on the visit");
    }

    let photoUrl: string | null = null;
    if (body.photo_url) {
      if (!isCloudinaryConfigured()) throw new BadRequest("Photo uploads are not enabled");
      try {
        photoUrl = assertOurUrl(body.photo_url, "Photo");
      } catch (e) {
        throw new BadRequest(e instanceof Error ? e.message : "Photo is invalid");
      }
    }

    // NotFound from the store becomes a 404 in fail(), so an unknown token
    // reads as "no such complaint" rather than a server error.
    await submitResolution({
      token,
      technician_name: personName(body.technician_name, "Your name"),
      technician_mobile: optStr(body.technician_mobile, "Mobile number", 15),
      outcome,
      action_taken: str(body.action_taken, "Work done", 2000, 5),
      photo_url: photoUrl,
      photo_public_id: photoUrl
        ? str(body.photo_public_id, "Photo reference", 200)
        : null,
    });

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    return fail(e);
  }
}
