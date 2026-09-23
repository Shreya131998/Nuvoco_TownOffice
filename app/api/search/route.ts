import { NextResponse } from "next/server";
import { fail, str } from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { toPublicComplaint } from "@/lib/public-complaint";
import { getOpenByQuarter } from "@/lib/sheets/store";

/**
 * The open complaints at one quarter, for a technician who has just done the
 * work and needs to say which complaint it closed.
 *
 * Quarter only. Asking for the resident's name on top read well but did not
 * survive contact with a doorstep: names are typed freehand when the
 * complaint is filed, so the spelling rarely matched what the technician
 * typed, and a correct address would return nothing.
 *
 * What that costs: picking a quarter is enough to read its open complaints.
 * Since /resolve can then close them, set STAFF_ACCESS_CODE if the township
 * would rather gate this behind one shared staff code.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 40;

export async function POST(req: Request) {
  try {
    if (!allow("search", clientIp(req), MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many searches. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const quarter = str(body.quarter_no, "Quarter", 40);
    const found = await getOpenByQuarter(quarter);

    if (found.length === 0) {
      return NextResponse.json(
        {
          error:
            "No open complaint at that address. / इस पते पर कोई लंबित शिकायत नहीं है।",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      complaints: found.map(toPublicComplaint),
    });
  } catch (e) {
    return fail(e);
  }
}
