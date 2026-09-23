import { NextResponse } from "next/server";
import { BadRequest, fail, mobile, personName, str } from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { assertOurUrl, isCloudinaryConfigured } from "@/lib/cloudinary";
import { submitComplaint } from "@/lib/sheets/store";

/**
 * The only writer into the Complaints tab.
 *
 * Open to anyone with the URL, so everything is validated here rather than
 * trusted from the form — including the photo URL, which the browser gets
 * from Cloudinary and could otherwise be swapped for anything.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!allow("complaint", ip, MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        {
          error:
            "Too many complaints from this connection. Please wait a few minutes. / कृपया कुछ मिनट बाद कोशिश करें।",
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new BadRequest("Invalid request");
    }

    // Honeypot: a real form leaves this empty because the field is off-screen
    // and aria-hidden. Answer 200 so a bot cannot tell it was caught.
    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ ok: true, token: "TO-000000-AAAA" });
    }

    let photoUrl: string | null = null;
    if (body.photo_url) {
      if (!isCloudinaryConfigured()) {
        throw new BadRequest("Photo uploads are not enabled");
      }
      try {
        photoUrl = assertOurUrl(body.photo_url, "Photo");
      } catch (e) {
        throw new BadRequest(e instanceof Error ? e.message : "Photo is invalid");
      }
    }

    const { token } = await submitComplaint({
      resident_name: personName(body.resident_name, "Name"),
      // Not upper-cased any more. That existed to make free text consistent
      // ("a-104" and "A-104" were two places); the block now comes from a
      // fixed list, so consistency is guaranteed and folding the case would
      // only turn "Guest House" into "GUEST HOUSE" on every screen.
      quarter_no: str(body.quarter_no, "Quarter", 40),
      mobile: mobile(body.mobile, "Mobile number"),
      issue_type_id: str(body.issue_type_id, "Issue type", 64),
      description: str(body.description, "Description", 2000),
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
