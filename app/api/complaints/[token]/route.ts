import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { normaliseToken } from "@/lib/token";
import { getByToken } from "@/lib/sheets/store";

/**
 * Public status lookup, used by /resolve to load a complaint before the
 * technician fills the form.
 *
 * Rate limited because the token is the only thing protecting a complaint's
 * contents. The token space is large enough that guessing is impractical, but
 * a limit makes enumeration pointless rather than merely slow.
 *
 * The response deliberately omits the resident's mobile number: the technician
 * is standing at the door, and a leaked token should not hand out a phone
 * number. The dashboard, which is behind a login, shows it.
 */

const WINDOW_MS = 5 * 60_000;
const MAX_PER_WINDOW = 40;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = clientIp(req);
    if (!allow("lookup", ip, MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many lookups. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const token = normaliseToken((await params).token);
    if (!token) {
      return NextResponse.json(
        { error: "A token is 6 characters, like 7K3M9P" },
        { status: 400 }
      );
    }

    const c = await getByToken(token);
    if (!c) {
      return NextResponse.json(
        {
          error:
            "We have no complaint with that token. Please check and try again. / इस टोकन की कोई शिकायत नहीं मिली।",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      complaint: {
        token: c.token,
        submitted_at: c.submitted_at,
        complaint_date: c.complaint_date,
        resident_name: c.resident_name,
        quarter_no: c.quarter_no,
        issue_type_en: c.issue_type_en,
        issue_type_hi: c.issue_type_hi,
        description: c.description,
        photo_urls: c.photo_urls,
        video_url: c.video_url,
        status: c.status,
        overdue: c.overdue,
        age_hours: c.age_hours,
        visits: c.visits.map((v) => ({
          resolved_at: v.resolved_at,
          technician_name: v.technician_name,
          outcome: v.outcome,
          action_taken: v.action_taken,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
