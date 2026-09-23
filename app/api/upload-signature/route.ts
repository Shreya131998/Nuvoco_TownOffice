import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/ratelimit";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary";

/**
 * Hands the browser a short-lived signature so it can upload one image
 * directly to Cloudinary.
 *
 * The API secret never leaves the server, and the signature covers the folder,
 * so a caller cannot redirect the upload elsewhere in the account. Cloudinary
 * rejects a signature older than an hour on its own.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;

export async function POST(req: Request) {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Photo uploads are not configured" },
      { status: 503 }
    );
  }

  if (!allow("sign", clientIp(req), MAX_PER_WINDOW, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    return NextResponse.json(signUpload(Math.round(Date.now() / 1000)));
  } catch (e) {
    console.error("[upload-signature]", e);
    return NextResponse.json(
      { error: "Photo uploads are unavailable" },
      { status: 500 }
    );
  }
}
