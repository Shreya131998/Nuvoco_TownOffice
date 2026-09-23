import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { getByQuarter } from "@/lib/sheets/store";

/**
 * Token recovery for a resident who lost theirs: every complaint at their
 * address, open or closed.
 *
 * Quarter only. The mobile number was a better secret, but a resident who has
 * already lost the token is the last person to make a second identifier
 * work — and the number they type has to match the one they typed when
 * filing, digit for digit.
 *
 * The honest trade: anyone who can pick an address can see its complaints and
 * their tokens, and a token is enough to close a complaint. Rate limited, and
 * every resolution records a name, so misuse is visible rather than silent —
 * but it is not prevented.
 */

const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 20;

export async function POST(req: Request) {
  try {
    if (!allow("recover", clientIp(req), MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many lookups. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const quarter = str(body.quarter_no, "Quarter", 40);
    const mine = await getByQuarter(quarter);

    if (mine.length === 0) {
      return NextResponse.json(
        {
          error:
            "No complaints found for that address. / इस पते की कोई शिकायत नहीं मिली।",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      complaints: mine.map((c) => ({
        token: c.token,
        complaint_date: c.complaint_date,
        submitted_at: c.submitted_at,
        resident_name: c.resident_name,
        issue_type_en: c.issue_type_en,
        issue_type_hi: c.issue_type_hi,
        status: c.status,
        overdue: c.overdue,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
