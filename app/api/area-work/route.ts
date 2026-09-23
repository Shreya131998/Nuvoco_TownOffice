import { NextResponse } from "next/server";
import {
  BadRequest,
  checkAccessCode,
  date,
  fail,
  optStr,
  personName,
  str,
} from "@/lib/api";
import { allow, clientIp } from "@/lib/ratelimit";
import { assertOurUrl, isCloudinaryConfigured } from "@/lib/cloudinary";
import { submitAreaWork } from "@/lib/sheets/store";
import { addDays, istToday } from "@/lib/dates";

/**
 * The only writer into the Area Work register.
 *
 * Deliberately takes no token and no quarter: a sweeping round or a garbage
 * collection covers the common areas, answers to no complaint, and has no
 * resident to show a slip.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 40;

export async function POST(req: Request) {
  try {
    checkAccessCode(req);

    if (!allow("area-work", clientIp(req), MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many entries. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new BadRequest("Invalid request");

    // Backdating a day or two is normal — a round gets written up the next
    // morning. Anything older, or in the future, is a typo worth catching.
    const workDate = date(body.work_date, "Date");
    const today = istToday();
    if (workDate > today) {
      throw new BadRequest("That date is in the future");
    }
    if (workDate < addDays(today, -30)) {
      throw new BadRequest("That date is more than a month ago");
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

    const { id } = await submitAreaWork({
      work_date: workDate,
      work_type_id: str(body.work_type_id, "Type of work", 64),
      area: optStr(body.area, "Area", 120),
      worker_name: personName(body.worker_name, "Your name"),
      worker_mobile: optStr(body.worker_mobile, "Mobile number", 15),
      notes: str(body.notes, "What was done", 2000, 5),
      photo_url: photoUrl,
      photo_public_id: photoUrl
        ? str(body.photo_public_id, "Photo reference", 200)
        : null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return fail(e);
  }
}
